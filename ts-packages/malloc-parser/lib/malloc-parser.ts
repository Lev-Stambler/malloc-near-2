import chevrotain, { Lexer } from "chevrotain";

const allTokens = [];

const createToken = (opts: chevrotain.ITokenConfig) => {
  const token = chevrotain.createToken(opts);

  allTokens.push(token);

  return token;
};

const WhiteSpace = createToken({
  name: `WhiteSpace`,
  pattern: /\s+/,
  group: Lexer.SKIPPED
})
