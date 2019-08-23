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
  }

  copyOf(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  readNext(program) {
    this.cursor.column++;
    let next_char = program.shift() || "";
    return [next_char, program]
  }

  loadProgram(program) {
    // Reset memory pointer to default (0)
    this.mem_ptr = 0;
    // Reset error list
    this.error_list = [];
    // Reset cursor's Y position
    this.cursor.line = 0;

    // Split each line of the program
    program = program.split("\n");

    // Compile each line
    while(program.length > 0) {
      // Reposition cursor
      this.cursor.line++;
      this.cursor.column = 0;
      // Analyse syntax on next line
      this.lexer(program.shift());
    }
    // If there were any errors, report them
    if(this.error_list.length > 0) {
      this.callError();
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
    // Letters, underscore or ':'
    /* FIXME: This matches multiple ':'s, which is not good! */
    const ALPHA = /[A-Z_:]/;
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

    // Consume letters, underscore or :
    [word,ch,line] = this.consume(ALPHA,ch,line);

    // If we found nothing but somehow we haven't returned before
    if(!word.length) {
      console.warn("(!) There should be no way to reach this point");
      return "";
    }
    // We found something, so let's check what it is
    else {
      // If it ends with ':', it's gotta be a label!
      /* There's nothing preventing someone from defining multiple labels
       * pointing to the same address, so let's loop through as many as we can
       * find
       */
      while(word.slice(-1) === ':') {
        // Add label to temporary storage so we can point it to the next
        // instruction
        this.labels.push(word.slice(0,-1));
        // Clean what we had found before
        word = "";
        // Consume more whitespace
        [_,ch,line] = this.consume(WS,ch,line);
        // Consume letters + underscore + :
        [word,ch,line] = this.consume(ALPHA,ch,line);
      }

      /* If we got here, there should be no labels in front of us anymore;
       * Apart from variable names, everything should be predictable from now on
       * Let's first check if what we found is an instruction
       */
      if(this.operations.hasOwnProperty(word)) {
        // Alright, this is an instruction! Let's check for any arguments
        // But firt, our usual whitespace consumption
        [_,ch,line] = this.consume(WS,ch,line);
        // Now let's look for A-Z, _, 0-9, #, @
        // We'll deal with parsing the arguments later
        [argc,ch,line] = this.consume(ARG,ch,line);

        // Put this "token" on intermediate list (so it's easier later to
        // convert everything to hex)
        const output = {
          // Inform what is it we're putting there so we don't have to
          // do the regex's all over again
          type: "instruction",
          // The actual instruction
          ins: word,
          // The arguments for it
          arg: argc,
          // Any and all label that have been defined immediatelly before this
          label: this.copyOf(this.labels)
        };
        // Clean labels tracker
        this.labels = [];
        // Put this in the intermediate array so we can turn it to hex later
        this.intermediate.push(output);
      }
      // What we found isn't an instruction, so let's see what else it could be
      else {
        // Everything from now on has at least a space after it, so let's read
        // it already
        [_,ch,line] = this.consume(WS,ch,line);

        switch(word) {
          // ORG <addr>
          case "ORG":
          // END <addr>
          case "END":
          // DS <imm>
          case "DS":
            [argc,ch,line] = this.consume(/[0-9]/,ch,line);

            if(argc.trim().length <= 0) {
              // There's no argument to ORG?! That's absurd!
              this.error_list.push({
                cat: "Syntax",
                desc: `ORG requires a number as an argument! E.g. "ORG 0"`,
                pos: this.copyOf(this.cursor)
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
            break;
          // DW <imm>, <imm>, ...
          case "DW":
            break;
          // STR "<characters>"
          case "STR":
            break;
          // <var> EQU <imm>
          default:
            break;
        }
      }

      // Alright we've gotten what we came for, but let's make sure the
      // programmer didn't put anything else in this line
      // Eat up some whitespace
      [_,ch,line] = this.consume(WS,ch,line);

      let garbo = "";
      // Let's check if there's, well, anything left
      [garbo,ch,line] = this.consume(/[^ \t]/,ch,line);

      // If we found anything, let's complain about it
      if(garbo.trim().length > 0) {
        garbo = garbo.trim();
        this.error_list.push({
          cat: "Syntax",
          desc: `Superfluous argument '${garbo}'`,
          pos: this.copyOf(this.cursor)
        });
      }
    }
  }

  callError() {
    if(this.error_list.length <= 0) return;
    for(let i of this.error_list) {
      console.warn(`${i.cat} error on line ${i.pos.line}, column ${i.pos.column}
${i.desc}`);
    }
  }
}