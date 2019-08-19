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

    this.mem_ptr = 0;
    this.cursor = {
      line: 0, column: 0
    };
    this.labels = {};

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

    // Preprocess each line
    for(let i = 0, l = program.length; i < l; i++) {
      // Reposition cursor
      this.cursor.line++;
      this.cursor.column = 0;
      program[i] = this.preprocess(program[i]);
    }

    // Compile each line
    while(program.length > 0) {
      // Reposition cursor
      this.cursor.line++;
      this.cursor.column = 0;
      // Get next line, split it into an array
      let line = program.shift().split("");
      // Analyse syntax
      this.lexer(line);
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

  preprocess(line) {
    // If we have a comment on this line,
    // get only what comes before it
    line = line.split(";")[0];
    // If line is/became empty, let's leave
    if(line.length <= 0) return "";
    // Turn string into array
    line = line.split("");

    // RegEx constants
    const WS = /[ \t]/;

    let _;        // Disposable placeholder variable
    let ch;       // Current character
    let line_err = this.error_t.NONE; // Error tracker

    // Consume whitespace
    [_,ch,line] = this.consume(WS,...this.readNext(line));

    // Consume letters
    let word = "";
    [word,ch,line] = this.consume(/[A-Z]/,ch,line);

    switch(word) {
      case "ORG":
      case "END":
      case "DS":
        // Consume whitespace
        [_,ch,line] = this.consume(WS,...this.readNext(line));

        let arg = "";
        [arg,ch,line] = this.consume(/[0-9]/,ch,line);

        console.log(`${word} ${arg}`);
        break;
      case "DB":
      case "DW":
        break;
      case "STR":
        // Consume whitespace
        [_,ch,line] = this.consume(WS,...this.readNext(line));

        if(ch === `"`) {
          // String of printable ASCII (except double quotes)
          let str = "";
          [str,ch,line] = this.consume(/[ !#-~]/,...this.readNext(line));

          if(ch === `"`) {
            console.log(`String "${str}"`);
          } else {
            // String is opened but never closed
            // e.g. STR "Banana
            line_err = this.error_t.INVALID_ARG;
            this.error_list.push({
              cat: `Syntax`,
              desc: `Unmatched string delimiter <">`,
              pos: this.copyOf(this.cursor)
            });
          }
        } else {
          // We have STR but not a string afterwards
          // e.g. STR 0
          line_err = this.error_t.INVALID_ARG;
          this.error_list.push({
            cat: `Syntax`,
            desc: `'STR' keyword not followed by string`,
            pos: this.copyOf(this.cursor)
          });
        }
        break;
      default:
        if(ch === ':') {
          console.log(`Label ${word}:`);
        }
        break;
    }

    // Return as string
    return line.join("");
  }

  lexer(line) {
    // If line is empty (or only whitespace), skip it
    if(line.filter(i=>i.trim().length).length <= 0)
      return;

    // RegEx constants
    const WS = /[ \t]/;
    const OP = /[A-Z]/;
    const ARG= /[0-9@#A-Z]/;

    let _;        // Disposable placeholder variable
    let ch;       // Current character
    let op = "";  // Instruction
    let arg = ""; // Argument
    let line_err = this.error_t.NONE; // Error tracker

    // Ignore whitespace at the beginning
    [_,ch,line] = this.consume(WS,...this.readNext(line));

    // Consume an instruction
    [op,ch,line] = this.consume(OP,ch,line);

    // If this is a valid instruction, write its hex
    // value to memory
    if(this.operations.hasOwnProperty(op)) {
      this.memory[this.mem_ptr] = this.operations[op];
      this.mem_ptr++;
    } else {
      // It's not a label and not an instruction,
      // it's gotta be an error
      line_err = this.error_t.INVALID_OP;
      this.error_list.push({
        cat: `Syntax`,
        desc: `Unknown instruction ${op}`,
        pos: this.copyOf(this.cursor)
      });
    }

    // Ignore whitespace between instruction and argument
    [_,ch,line] = this.consume(WS,...this.readNext(line));

    // Consume an argument
    [arg,ch,line] = this.consume(ARG,ch,line);

    // If argument exists, and instruction is valid
    if(arg.length > 0
    && line_err !== this.error_t.INVALID_OP) {
      // If argument is a valid number
      const arg_value = Number(arg);
      if(arg_value <= 255 && !isNaN(arg_value)) {
        // Write argument to memory
        this.memory[this.mem_ptr] = arg;
        this.mem_ptr++;
      } else {
        // We have an argument, but it's not a
        // number
        line_err = this.error_t.INVALID_ARG;
        this.error_list.push({
          cat: `Syntax`,
          desc: `Invalid argument '${arg}'`,
          pos: this.copyOf(this.cursor)
        });
      }

      // Consume whitespaces after argument
      [_,ch,line] = this.consume(WS,...this.readNext(line));
    }

    // If we have something in the buffer
    if(ch.length !== 0) {
      // Gather everything left
      let garbage_pos = this.copyOf(this.cursor);
      let trailing_garbage = "";
      [trailing_garbage,ch,line] = this.consume(/[^;\n]/,...this.readNext(line));

      // We found something that isn't whitespace
      // or a comment => error
      line_err = this.error_t.MILD;
      this.error_list.push({
        cat: `Syntax`,
        desc: `Invalid value '${trailing_garbage.trim()}' after instruction`,
        pos: garbage_pos
      });
    }

    switch(line_err) {
      case this.error_t.NONE:
        console.log(
`Instruction:  [${op}]
with value of [0x${this.operations[op].toString(16).padStart(2,"0")}]
with argument [${arg}]`);
        break;

      case this.error_t.INVALID_OP:
        console.log(
`Instruction:  [${op}] (invalid)
with no value
with argument [${arg}]`);
        break;

      case this.error_t.INVALID_ARG:
        console.log(
`Instruction:  [${op}]
with value of [0x${this.operations[op].toString(16).padStart(2,"0")}]
with argument [${arg}] (invalid)`);
        break;

      case this.error_t.MILD:
        console.log(
`Instruction:  [${op}]
with value of [0x${this.operations[op].toString(16).padStart(2,"0")}]
with argument [${arg}]
with MILD error`);
        break;

      default:
        console.log("?");
        break;
    }
  }

  callError() {
    if(this.error_list.length <= 0) return;
    for(let i of this.error_list) {
      console.warn(`${i.cat} error on line ${i.pos.line}, column ${i.pos.column}
${i.desc}`);
    }
  }

  parser(ins) {
  }
}