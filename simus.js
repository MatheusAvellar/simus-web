class SimuS {
  constructor() {
    this.MEMORY_SIZE = 0x800;
    this.memory = new Uint8Array(this.MEMORY_SIZE/8);

    this.error_list = [];

    this.lexemes = [];
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
    // Reset memory
    this.memory = new Uint8Array(this.MEMORY_SIZE/8);
    // Reset memory UI
    [...document.getElementsByClassName("changed")].forEach(e => {
      e.innerText = "00";
      e.classList.remove("changed");
    });
    // Reset memory pointer to default (0)
    this.mem_ptr = 0;
    // Reset error list
    this.error_list = [];
    // Reset cursor's Y position
    this.cursor.line = 0;
    // Clear lexemes
    this.lexemes = [];
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
    // Whitespace (space / tab / etc)
    const WS = /\s/;
    // Letters and underscore
    const ALPHA = /[A-Z_]/i;
    // Hexadecimal numbers
    const HEX = /[0-9A-F]/;

    let _;          // Disposable placeholder variable (for whitespace 'words')
    let ch = " ";         // Current character
    let word;  // Current word

    // While there's anything in this line
    while(line.length > 0 || ch.length) {
      // Reset word from previous iteration
      word = "";

      // Ignore whitespace at the beginning
      [_,ch,line] = this.consume(WS,ch,line);

      // If the next character in the buffer is a letter or underscore
      if(ch.match(ALPHA)) {
        // Consume letters or underscore to form a word
        [word,ch,line] = this.consume(ALPHA,ch,line);
        //if(+ch == 3) debugger
        // We found a word, let's save it and continue
        this.lexemes.push({
          typ: "id",
          val: word,
          pos: {
            line: this.cursor.line,
            column: this.cursor.column - word.length
          },
          len: word.length
        });
        continue;
      }
      // If we found an immediate value (#<number>)
      else if(ch.match(HEX) || ch.match(/#/)) {
        let _type = (ch.match(HEX)) ? "num" : "imm";
        let _first_ch = ch;
        // Get next character
        [ch,line] = this.readNext(line);
        // Consume 0-9 and A-F
        [word,ch,line] = this.consume(HEX,ch,line);
        word = _first_ch + word;

        if(ch === 'H' || ch === 'h') {
          word += "H";
          // Read next character and leave it on 'ch'
          [ch,line] = this.readNext(line);
        }
        // If there's A-F inside the number but it doesn't have H after it
        else if(word.match(/[A-F]/)) {
          // Throw error
          this.error_list.push({
            cat: "Syntax",
            desc: `Invalid base-10 number '${word}'. Are you forgetting 'H'?`,
            pos: {
              line: this.cursor.line,
              column: this.cursor.column - word.length
            },
            len: word.length
          });
          // Ignore rest of the line
          return;
        }
        // We found a word, let's save it and continue
        this.lexemes.push({
          typ: _type,  // This can be "num" or "imm"
          val: word,
          pos: {
            line: this.cursor.line,
            column: this.cursor.column - word.length
          },
          len: word.length
        });
        continue;
      }
      // If we found the beginning of a string
      else if(ch.match(/\"/)) {
        // Get next character
        [ch,line] = this.readNext(line);
        // Consume everything inside
        [word,ch,line] = this.consume(/[^\r\n"]/,ch,line);
        // If the string wasn't closed
        if(ch !== '"') {
          // Throw error
          this.error_list.push({
            cat: "Syntax",
            desc: `Unclosed string '${word}'`,
            pos: {
              line: this.cursor.line,
              column: this.cursor.column - word.length - 1
            },
            len: word.length + 1
          });
          // Ignore rest of the line
          return;
        }
        // Otherwise, if it was closed properly
        else {
          // Read next character and leave it on 'ch'
          [ch,line] = this.readNext(line);
          // We found a word, let's save it and continue
          this.lexemes.push({
            typ: "str",
            val: word,
            pos: {
              line: this.cursor.line,
              column: this.cursor.column - word.length
            },
            len: word.length
          });
          continue;
        }
      }
      // Otherwise, let's get whatever character we found
      else switch(ch) {
        default: {
          // If it's empty, ready next and continue
          if(!ch.trim().length) {
            [ch,line] = this.readNext(line);
            continue;
          }
          // Otherwise, push it as it is
          this.lexemes.push({
            typ: "chr",
            val: ch,
            pos: {
              line: this.cursor.line,
              column: this.cursor.column - 1
            },
            len: 1
          });
          // Then get next and continue
          [ch,line] = this.readNext(line);
          continue;
        }
      }
    }
  }

  parser() {

  }

  setMemory(index,value) {
    index = +index;
    value = +value;
    if(isNaN(index) || isNaN(value))
      return;

    // Update internal memory
    this.memory[index] = value;
    // Update UI
    const elementID = index.toString(16).toUpperCase().padStart(4,"0");
    const elementRef = document.getElementById(elementID);
    elementRef.innerText = value.toString(16).toUpperCase().padStart(2,"0");
    elementRef.classList.add("changed");
  }
}