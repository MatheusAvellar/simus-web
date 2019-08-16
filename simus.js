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

  lexer(program) {
    // If line is empty (or only whitespace), skip it
    if(program.filter(i=>i.trim().length).length <= 0)
      return;

    // RegEx constants
    const WS = /[ \t]/;
    const OP = /[A-Z]/;
    const ARG= /[0-9@#A-Z]/;

    let _;        // Disposable placeholder variable
    let ch;       // Current character
    let op = "";  // Instruction
    let arg = ""; // Argument
    let inside_comment = false;       // Comment tracker
    let line_err = this.error_t.NONE; // Error tracker

    // Ignore whitespace at the beginning
    [_,ch,program] = this.consume(WS,...this.readNext(program));

    // If we reach a comment, we're done here
    if(ch === ';') return;

    // Consume an instruction
    [op,ch,program] = this.consume(OP,ch,program);

    // If this is a valid instruction, write its hex
    // value to memory
    if(this.operations.hasOwnProperty(op)) {
      this.memory[this.mem_ptr] = this.operations[op];
      this.mem_ptr++;
    } else {
      // We found a word, but it's not a valid instruction

      // Let's check if it's a label before erroring
      if(ch === ':') {
        // Hurray, it's a label!
        // If this label has already been defined
        if(this.labels.hasOwnProperty(op)) {
          // Woops!
          line_err = this.error_t.ALREADY_DEFINED;
          this.error_list.push({
            cat: `Syntax`,
            desc: `Label ${op} has already been defined`,
            pos: this.copyOf(this.cursor)
          });
        }
        // If it hasn't been defined
        else {
          // Add it to our dictionary
          this.labels[op] = this.mem_ptr;
          // We no longer have an instruction
          op = "";

          // Let's try finding another instruction
          // Consume all whitespace after this label
          [_,ch,program] = this.consume(WS,...this.readNext(program));
          // If we reach a comment, we're done here
          if(ch === ';') return;
          // Consume an instruction
          [op,ch,program] = this.consume(OP,ch,program);
          if(this.operations.hasOwnProperty(op)) {
            this.memory[this.mem_ptr] = this.operations[op];
            this.mem_ptr++;
          } else {
            // FIXME: This code is a mess, and you could
            // have multiple labels one after the other;
            // Perhaps turn this into a while() loop?

            // We have consumed a label already (!)
            // and a new instruction isn't valid
            line_err = this.error_t.INVALID_OP;
            this.error_list.push({
              cat: `Syntax`,
              desc: `Unknown instruction ${op}`,
              pos: this.copyOf(this.cursor)
            });
          }
        }
        //... do label things idk
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
    }

    // Ignore whitespace between instruction and argument
    [_,ch,program] = this.consume(WS,...this.readNext(program));

    // If we reach a comment, we're done here
    if(ch === ';') inside_comment = true;

    if(!inside_comment) {
      // Consume an argument
      [arg,ch,program] = this.consume(ARG,ch,program);

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
      }

      // Consume whitespaces after argument
      [_,ch,program] = this.consume(WS,...this.readNext(program));
    }

    // If we reach a comment, we're done here
    if(ch === ';') inside_comment = true;

    // If we have something in the buffer
    if(!inside_comment && ch.length !== 0) {
      // Gather everything left
      let garbage_pos = this.copyOf(this.cursor);
      let trailing_garbage = "";
      [trailing_garbage,ch,program] = this.consume(/[^;\n]/,...this.readNext(program));

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