# SimuS Web

Veja a demo online [aqui](https://matheusavellar.github.io/simus-web/) (ainda está em desenvolvimento!)

## Introdução

Esse simulador é inspirado no projeto original do [SimuS](https://github.com/sottam/simus).
Em suma, é um simulador do processador [Sapiens](https://dcc.ufrj.br/~gabriel/simus.php), como
aplicação web (HTML/CSS/JS). Como descrito em seu [paper](http://www2.sbc.org.br/ceacpad/ijcae/v7_n1_dec_2018/IJCAE_v7_n1_dez_2018_paper_4_vf.pdf),

> O Sapiens é um processador hipotético utilizado para o ensino de arquitetura de computadores,
e foi desenvolvido como uma evolução do processador [Neander-X](https://dcc.ufrj.br/~gabriel/neander.php).

## Instruções

O Sapiens utiliza-se de instruções de 8 bits, listadas a seguir:

| Mnemônico                  | Código    | Descrição                                                                       |
|----------------------------|:---------:|---------------------------------------------------------------------------------|
| NOP                        |<nobr>0000 0000</nobr>| Não faz nada                                                         |
| STA ender<br>STA @ender    |<nobr>0001 000x</nobr>| Armazena o acumulador (um byte) na memória                           |
| STS ender<br>STS @ender    |<nobr>0001 010x</nobr>| Armazena o apontador de pilha (dois bytes) na memória                |
| LDA #imed<br>LDA ender<br>LDA @ender|<nobr>0010 00xx</nobr>| Carrega o operando (um byte) no acumulador                  |
| LDS #imed16<br>LDS ender<br>LDS @ender|<nobr>0010 01xx</nobr>| Carrega o operando (dois bytes) no apontador de pilha (SP)|
| ADD #imed<br>ADD ender<br>ADD @ender|<nobr>0011 00xx</nobr>| Soma o acumulador com o operando (um byte)                  |
| ADC #imed<br>ADC ender<br>ADC @ender|<nobr>0011 01xx</nobr>| Soma o acumulador com o carry (flag C) e com o operando (um byte)|
| SUB #imed<br>SUB ender<br>SUB @ender|<nobr>0011 10xx</nobr>| Subtrai o acumulador do operando (um byte)                  |
| SBC #imed<br>SBC ender<br>SBC @ender|<nobr>0011 11xx</nobr>| Subtrai o acumulador do carry (flag C) e do operando (um byte)|
| OR #imed<br>OR ender<br>OR @ender|<nobr>0100 00xx</nobr>| Realiza um "ou" bit a bit entre o acumulador e o operando (um byte)|
| XOR #imed<br>XOR ender<br>XOR @ender|<nobr>0100 01xx</nobr>| Realiza um "ou exclusivo" bit a bit entre o acumulador e o operando (um byte)|
| AND #imed<br>AND ender<br>AND @ender |<nobr>0101 00xx</nobr>| Realiza um "e" bit a bit entre o acumulador e o operando (um byte)|
| NOT                        |<nobr>0110 0000</nobr>| Complementa ('0' → '1' e '1' → '0') os bits do acumulador.            |
| SHL                        |<nobr>0111 0000</nobr>| Deslocamento do acumulador de um bit para a esquerda, através do carry|
| SHR                        |<nobr>0111 0100</nobr>| Deslocamento do acumulador de um bit para a direita através do carry  |
| SRA                        |<nobr>0111 1000</nobr>| Deslocamento do acumulador de um bit para a direita através do carry  |
| JMP ender<br>JMP @ender    |<nobr>1000 000x</nobr>| Desvia a execução do programa para o endereço                         |
| JN ender<br>JN @ender      |<nobr>1001 000x</nobr>| Desvia a execução do programa para o endereço, apenas se N = 1        |
| JP ender<br>JP @ender      |<nobr>1001 010x</nobr>| Desvia a execução do programa para o endereço, apenas se N = 0 e Z = 0|
| JZ ender<br>JZ @ender      |<nobr>1010 000x</nobr>| Desvia a execução do programa para o endereço, apenas se Z = 1        |
| JNZ ender<br>JNZ @ender    |<nobr>1010 010x</nobr>| Desvia a execução do programa para o endereço, apenas se Z = 0        |
| JC ender<br>JC @ender      |<nobr>1011 000x</nobr>| Desvia a execução do programa para o endereço, apenas se C =1         |
| JNC ender<br>JNC @ender    |<nobr>1011 010x</nobr>| Desvia a execução do programa para o endereço, apenas se C = 0        |
| IN ender8                  |<nobr>1100 0000</nobr>| Carrega no acumulador o valor lido no endereço de E/S                 |
| OUT ender8                 |<nobr>1100 0100</nobr>| Descarrega o conteúdo do acumulador no endereço de E/S                |
| JSR ender<br>JSR @ender    |<nobr>1101 000x</nobr>| Desvia para procedimento                                              |
| RET                        |<nobr>1101 1000</nobr>| Retorno de procedimento                                               |
| PUSH                       |<nobr>1110 0000</nobr>| Coloca o conteúdo do acumulador no topo da pilha                      |
| POP                        |<nobr>1110 0100</nobr>| Retira o valor que está no topo da pilha e coloca no acumulador       |
| TRAP ender<br>TRAP @ender  |<nobr>1111 0000</nobr>| Instrução para emulação de rotinas de E/S pelo simulador              |
| HLT                        |<nobr>1111 1111</nobr>| Para a máquina                                                        |


Também estão disponíveis comandos da linguagem de montagem que são pré-processados:

| Comando        | Descrição                 |
|----------------------------|-----------------|
| Comentários                | Os comentários são começados por **ponto e vírgula (;)** e podem também ocorrer no final das linhas de instruções.                                                                                                                                                         |
| Rótulos                    | Um rótulo é um nome dado à próxima posição de memória. Deve ser seguido por **dois pontos (:)**.                                                                                                                                                                           |
| <nobr>ORG ender</nobr>                  | A diretiva **ORG** (origin) indica ao montador que a próxima instrução ou dados devem ser colocados na posição de memória indicada por ender.                                                                                                                              |
| <nobr>var EQU imed</nobr>               | A diretiva **EQU** (equate) associa um nome (rótulo) a um certo valor. Esse comando é freqüentemente usado para especificar variáveis que são posicionadas em um endereço específico de memória. Por exemplo, para posicionar a variável X no endereço 100 use: X EQU 100. |
| <nobr>END ender</nobr>                  | A diretiva **END** indica que o programa fonte acabou. O operando ender é usado para pré-carregar o PC com o endereço inicial de execução do programa.                                                                                                                     |
| <nobr>DS imed</nobr>                    | A diretiva **DS** (define storage) reserva um número de palavras na memória definido pelo valor imed.                                                                                                                                                                      |
| <nobr>DB imed1, imed2, imed3 ...</nobr> | A diretiva **DB** (define byte) carrega nesta palavra de memória e nas seguintes o(s) valor(es) de 8bits definido(s) pelo(s) operando(s) imed1, imed2, imed3 ...                                                                                                           |
| <nobr>DW imed1, imed2, imed3 ...</nobr> | A diretiva **DW** (define word) carrega nesta palavra de memória e nas seguintes o(s) valor(es) de 16 bits definido(s) pelo(s) operando(s) imed1, imed2, imed3 ...                                                                                                         |
| <nobr>STR "cadeia de caracteres"</nobr> | A diretiva **STR** (define string) carrega nesta palavra de memória e nas seguintes o(s) valor(es) o código ASCII correspondente aos caracteres da cadeia entre aspas.                                                                                                    |
