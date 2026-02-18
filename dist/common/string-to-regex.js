import { e as escapeStringRegexp } from "../index3.js";
import { r as regexParser } from "../index2.js";
const stringToRegex = (search) => {
  return /^\/.+\/[AJUXgimsux]*$/.test(search) ? regexParser(search) : new RegExp(escapeStringRegexp(search), "g");
};
export {
  stringToRegex
};
