
// commify the passed number.
export function commify(number: string) {
  // Separate the decimal part and the integer part if a decimal exists
  const [integerPart, decimalPart] = number.split('.');

  // Use regular expression to add commas to the integer part
  const withCommas = integerPart?.replace(/\B(?=(\d{3})+(?!\d))/g, ',') || '';

  // If there's a decimal part, append it back to the result
  return decimalPart ? `${withCommas}.${decimalPart}` : withCommas;
}

// console.log("BEGIN commify tests");
// [
//   '1',
//   '123',
//   '123.33455',
//   '3.0',
//   '3.00',
//   '3.0050',
//   '584.0',
//   '1584.0464',
//   '15345384.00',
//   '0.00124',
//   '0.0',
//   '100000.000055',
//   '0',
//   '.0123',
//   '',
//   '-1',
//   '-123',
//   '-123.33455',
//   '-3.0',
//   '-3.00',
//   '-3.0050',
//   '-584.0',
//   '-1584.0464',
//   '-15345384.00',
//   '-0.00124',
//   '-0.0',
//   '-100000.000055',
//   '-0',
//   '-.0123',
//   '-',
// ].forEach(t => console.log(t, commify(t)));
// console.log("END commify tests");
