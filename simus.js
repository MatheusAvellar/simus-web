class SimuS {
  constructor() {
    this.memory = new Uint8Array(257);

    this.error_list = [];
    this.error_t = {
      NONE: 0,
      INVALID_OP: 1,
      INVALID_ARG: 2,
      MILD: 3
    };

    this.intermediate = [];
    this.labels = [];
    this.variables = [];

    this.mem_ptr = 0;
    this.cursor = {
      line: 0, column: 0
    };

    this.PC = 0;
    this.operations = {
      NOP: 0b00000000,
      STA: 0b00010000,
      STS: 0b00010100,
      LDA: 0b00100000,
      LDS: 0b00100100,
      ADD: 0b00110000,
      ADC: 0b00110100,
      SUB: 0b00111000,
      SBC: 0b00111100,
      OR:  0b01000000,
      XOR: 0b01000100,
      AND: 0b01010000,
      NOT: 0b01100000,
      SHL: 0b01110000,
      SHR: 0b01110100,
      SRA: 0b01111000,
      JMP: 0b10000000,
      JN:  0b10010000,
      JP:  0b10010100,
      JZ:  0b10100000,
      JNZ: 0b10100100,
      JC:  0b10110000,
      JNC: 0b10110100,
      IN:  0b11000000,
      OUT: 0b11000100,
      JSR: 0b11010000,
      RET: 0b11011000,
      PUSH:0b11100000,
      POP: 0b11100100,
      TRAP:0b11110000,
      HLT: 0b11111111
    };

    this.keywords = [
      "ORG", "EQU", "END", "DS", "DB", "DW", "STR"
    ];
  }

  copyOf(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  readNext(program) {
    this.cursor.column++;
    let next_char = program.shift() || "";
    return [next_char, program]
  }

  callError(lines) {
    for(let i = 0; i < this.error_list.length; i++) {
      const err = this.error_list[i];
      console.warn(`in.asm:${err.pos.line}:${err.pos.column}: ${err.cat} error!
${err.desc}
| ${lines[err.pos.line-1]}
  ${" ".repeat(Math.max(err.pos.column-1,0))}^${"~".repeat(Math.max(err.len-1,0))}`);
    }
  }

  reset() {
    // Reset memory pointer to default (0)
    this.mem_ptr = 0;
    // Reset error list
    this.error_list = [];
    // Reset cursor's Y position
    this.cursor.line = 0;
    // Clear intermediate memory
    this.intermediate = [];
    // Clear variables list
    this.variables = [];
    // Clear labels list
    this.labels = [];
  }

  compile(source,opt) {
    // Reset compiler state
    this.reset();

    // FIXME: Rename this function to something more adequate
    this.loadProgram(source);

    // If there were no syntax errors
    if(!this.error_list.length) {
      this.parser();
    } else {
      this.reset();
      return -1;
    }

    // If there were no errors at all
    if(!this.error_list.length) {
      return 0;
    }
    // Otherwise, if there were any errors
    this.reset();
    return -1;
  }

  loadProgram(program) {
    // Split each line of the program
    const lines = program.split("\n");

    // Compile each line
    while(lines.length > 0) {
      // Reposition cursor
      this.cursor.line++;
      this.cursor.column = 0;
      // Analyse syntax on next line
      this.lexer(lines.shift());
    }
    // If there were any errors, report them
    if(this.error_list.length > 0) {
      this.callError(program.split("\n"));
    }
  }

  consume(regex,ch,program) {
    let res = "";
    while(ch.match(regex) !== null) {
      res += ch;
      [ch,program] = this.readNext(program);
    }
    return [res, ch, program];
  }

  lexer(line) {
    // If we have a comment on this line, get only what comes before it
    line = line.split(";")[0];
    // If line is/became empty, let's leave
    if(line.trim().length <= 0) return "";
    // Turn line into array
    line = line.split("");

    // RegEx constants
    // Whitespace (space or tab)
    const WS = /[ \t]/;
    // Letters and underscore
    const ALPHA = /[A-Z_]/;
    // Digits
    const NUM = /[0-9]/;
    // Argument: letter, underscore, #, @ or digit
    const ARG = /[A-Z_#@0-9]/;

    let _;          // Disposable placeholder variable (for whitespace 'words')
    let ch;         // Current character
    let word = "";  // Current word
    let argc = "";  // Argument

    // Read first character
    [ch,line] = this.readNext(line);

    // Ignore whitespace at the beginning
    [_,ch,line] = this.consume(WS,ch,line);

    // Consume letters or underscore
    [word,ch,line] = this.consume(ALPHA,ch,line);

    // We hit something that isn't composed of letters (so, likely a number)
    if(!word.length) {
      // Let's read whatever it is
      [word,ch,line] = this.consume(/[^ \t]/,ch,line);
      if(!word.length) {
        // There's just nothing here somehow
        return "";
      } else {
        // Whatever this is, I hate it, let's nag about it
        this.error_list.push({
          cat: "Syntax",
          desc: `Unexpected non-word '${word}'`,
          pos: {
            line: this.cursor.line,
            column: this.cursor.column - word.length
          },
          len: word.length
        });
      }
    }
    // We found a word! Hurray! Let's check what it is
    else {
      // If it ends with ':', it's gotta be a label!
      /* There's nothing preventing someone from defining multiple labels
       * pointing to the same address, so let's loop through as many as we can
       * find
       */
      while(ch === ':') {
        // Verify that the label isn't a reserved word
        if(this.operations.hasOwnProperty(word)
        || this.keywords.indexOf(word) !== -1) {
          // If it is, log error
          this.error_list.push({
            cat: "Syntax",
            desc: `Invalid label name: '${word}' is a reserved word`,
            pos: {
              line: this.cursor.line,
              column: this.cursor.column - `${word}`.length
            },
            len: word.length
          });
        }
        // Add label to temporary storage so we can point it to the next
        // instruction
        this.labels.push(word);
        // Clean what we had found before
        word = "";
        // Read next character (to get rid of the previous ':')
        [ch,line] = this.readNext(line);
        // Consume more whitespace
        [_,ch,line] = this.consume(WS,ch,line);
        // Consume letters and underscore
        [word,ch,line] = this.consume(ALPHA,ch,line);
        // <ch> buffer will contain the following character; we only loop if
        // it's a ':'
      }

      /* If we got here, there should be no labels in front of us anymore;
       * Apart from variable names, everything should be predictable from now on
       * Let's first check if what we found is an instruction
       */
      if(this.operations.hasOwnProperty(word)) {
        // Alright, this is an instruction! Let's check for any arguments
        // But firt, our usual whitespace consumption
        [_,ch,line] = this.consume(WS,ch,line);
        if(_.length === 0) {
          // We didn't find any whitespace, so let's not bother looking for an
          // argument
          const output = {
            // Inform what is it we're putting there so we don't have to
            // do the regex's all over again
            type: "instruction",
            // The actual instruction
            ins: word,
            // No whitespace afterwards = no argument
            arg: "",
            // Any and all label that have been defined immediatelly before this
            label: this.copyOf(this.labels)
          };
          // Clean labels tracker
          this.labels = [];
          // Put this in the intermediate array so we can turn it to hex later
          this.intermediate.push(output);
        } else {
          /* There was whitespace, meaning there could be an argument!
           * Let's look for A-Z, _, 0-9, # and @ – we'll deal with parsing the
           * arguments later
           */
          [argc,ch,line] = this.consume(ARG,ch,line);

          // Put this "token" on intermediate list (so it's easier later to
          // convert everything to hex)
          const output = {
            // Inform what is it we're putting there so we don't have to
            // do the regex's all over again
            type: "instruction",
            // The actual instruction
            ins: word,
            // The arguments for it (this may very well be empty!)
            arg: argc,
            // Any and all label that have been defined immediatelly before this
            label: this.copyOf(this.labels)
          };
          // Clean labels tracker
          this.labels = [];
          // Put this in the intermediate array so we can turn it to hex later
          this.intermediate.push(output);
        }
      }
      // What we found isn't an instruction, so let's see what else it could be
      // (given that is has a length, i.e. isn't just empty)
      else if(word.trim().length) {
        // Everything from now on has at least a space after it, so let's read
        // it already; first, we reset the disposable variable
        _ = "";
        // Then we consume whitespace
        [_,ch,line] = this.consume(WS,ch,line);
        // And check if there was any whitespace
        if(_.length === 0) {
          // We didn't find whitespace, meaning there's an error already
          // Let's complain about it
          this.error_list.push({
            cat: "Syntax",
            desc: `Expected whitespace after word '${word}'`,
            pos: this.copyOf(this.cursor),
            len: 0
          });
        } else {
          // There's space after it! So let's finally see what it is
          switch(word) {
            // ORG <addr>
            case "ORG":
            // END <addr>
            case "END":
            // DS <imm>
            case "DS":
              // Consume a number
              [argc,ch,line] = this.consume(NUM,ch,line);

              // If there is no number there
              if(argc.trim().length <= 0) {
                // Complain about it
                this.error_list.push({
                  cat: "Syntax",
                  desc: `ORG requires a number as an argument! E.g. "ORG 0"`,
                  pos: this.copyOf(this.cursor),
                  len: 0
                });
              }
              // There's supposedly a valid argument, let's push it to the list!
              else {
                const output = {
                  // Inform what is it we're putting there so we don't have to
                  // do the regex's all over again
                  type: "keyword",
                  // The "instruction" is that keyword
                  ins: word,
                  // The arguments for it
                  arg: argc,
                  // Add potential labels to this
                  label: this.copyOf(this.labels)
                };
                // Clean labels tracker
                this.labels = [];
                // Put this in the intermediate array
                this.intermediate.push(output);
              }
              break;
            // DB <imm>, <imm>, ...
            case "DB":
            // DW <imm>, <imm>, ...
            case "DW":
              // Create array to store list of values
              const vals = [];
              // Consume a number
              [argc,ch,line] = this.consume(NUM,ch,line);
              // If there's no argument here
              if(argc.trim().length <= 0) {
                // Let's complain a bit

              } else {
                // We found at least one number! Let's add it to the list
                vals.push(+argc);

                // Consume potential whitespace before comma
                [_,ch,line] = this.consume(WS,ch,line);

                // And search for more numbers
                while(ch === ',') {
                  // Read next character (to get rid of the previous ',')
                  [ch,line] = this.readNext(line);
                  // Consume potential whitespace before number
                  [_,ch,line] = this.consume(WS,ch,line);
                  // Consume another number
                  [argc,ch,line] = this.consume(NUM,ch,line);
                  // If we found a number
                  if(argc.trim().length) {
                    // Let's add it to the list
                    vals.push(+argc);
                  }
                  // Consume potential whitespace after number
                  [_,ch,line] = this.consume(WS,ch,line);
                }

                // We're done finding numbers!
                const output = {
                  // Inform what is it we're putting there so we don't have to
                  // do the regex's all over again
                  type: "keyword",
                  // The "instruction" is that keyword
                  ins: word,
                  // The values we found
                  arg: this.copyOf(vals),
                  // Add potential labels to this
                  label: this.copyOf(this.labels)
                };
                // Clean labels tracker
                this.labels = [];
                // Put this in the intermediate array
                this.intermediate.push(output);
              }
              break;
            // STR "<characters>"
            case "STR":
              // If there is no string opening after "STR"
              if(ch !== '"') {
                this.error_list.push({
                  cat: "Syntax",
                  desc: `No string found after STR`,
                  pos: this.copyOf(this.cursor),
                  len: 0
                });
                break;
              }
              // Otherwise, we're now reading the string
              // Let's read the next character to get rid of the '"'
              [ch,line] = this.readNext(line);
              // Then consume every ASCII character (except '"' of course)
              let string = "";
              [string,ch,line] = this.consume(/[ !#-~]/,ch,line);
              // And now we check if the string wasn't closed
              if(ch !== '"') {
                this.error_list.push({
                  cat: "Syntax",
                  desc: `Unclosed string "${string}["]`,
                  pos: this.copyOf(this.cursor),
                  len: 0
                });
                break;
              }
              // If we got here, then the string was closed! Let's clean up the
              // buffer, then add the string to the intermediate memory array
              [ch,line] = this.readNext(line);
              const output = {
                // Inform what is it we're putting there so we don't have to
                // do the regex's all over again
                type: "keyword",
                // The "instruction" is that keyword
                ins: word,
                // The values we found
                arg: string,
                // Add potential labels to this
                label: this.copyOf(this.labels)
              };
              // Clean labels tracker
              this.labels = [];
              // Put this in the intermediate array
              this.intermediate.push(output);
              break;
            // <var> EQU <imm>
            default:
              // If there's nothing here, just leave
              if(word.trim().length <= 0) break;

              /* We have <var> inside the variable <word>, and we have also read
               * a whitespace afterwards. First, we have to make sure this is an
               * EQU expression and not something else
               */
              let eq = "";
              // Consume letters
              [eq,ch,line] = this.consume(ALPHA,ch,line);
              // If what we found is NOT an "EQU"
              if(eq !== "EQU") {
                // Complain about it
                this.error_list.push({
                  cat: "Syntax",
                  desc: `Unknown expression '${word} ${eq}'`,
                  pos: {
                    line: this.cursor.line,
                    column: this.cursor.column - `${word} ${eq}`.length
                  },
                  len: `${word} ${eq}`.length
                });
                // And get out of here
                break;
              }
              /* Otherwise, if we did find "EQU", we're almost good to go! All
               * that's left is for us to read a number after the EQU. So first
               * let's consume potential whitespace before the number
               */
              [_,ch,line] = this.consume(WS,ch,line);
              // Then try to consume the number
              let val = "";
              [val,ch,line] = this.consume(NUM,ch,line);
              // Check if we found a number
              if(val.trim().length <= 0) {
                // Uh oh! There's no number there!
                this.error_list.push({
                  cat: "Syntax",
                  desc: `Invalid value for variable '${word}' `
                  + `Must be a number, e.g. '${word} EQU 0'`,
                  pos: this.copyOf(this.cursor),
                  len: 0
                });
                break;
              }
              // Otherwise, we did find a number! Hurrah! Let's add this new
              // variable to the list and deal with it later in parsing
              this.variables.push({
                name: word,
                value: val
              });
              break;
          }
        }
      }

      // Alright we've gotten what we came for, but let's make sure the
      // programmer didn't put anything else in this line!
      // If there's anything, let's complain about it
      [_,ch,line] = this.consume(WS,ch,line);
      const garbo = [ch,...line].join("").trim();
      if(garbo.length > 0) {
        this.error_list.push({
          cat: "Syntax",
          desc: `Unexpected character${garbo.length > 1 ? "s" : ""} '${garbo}'`,
          pos: this.copyOf(this.cursor),
          len: garbo.length
        });
      }
    }
  }

  parser() {
    //for(let i = 0; i < this.intermediate.length; i++) {

      /*{ type:  "keyword"
          ins:   word
          arg:   string
          label: this.copyOf(this.labels) }*/

      //this.intermediate[i]
    //}
  }
}