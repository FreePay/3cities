// Test cases for eslint-rules/no-conditional-returns.js:

// // ********************************************************
// // no-conditional-returns: examples of rule non-violations

// export function testNonViolation1(s: string): number {
//   if (s.length < 0) {
//     return 5;
//   } else if (s.length === 17) return 9;
//   else if (s.length === 19) throw "Foo";
//   else if (s.length === 23) {
//     if (s.length < 0) {
//       return 5;
//     } else if (s === 'abc') return 9;
//     else if (s === 'def') throw "Foo";
//     else if (s === 'asdf') return 39;
//     else throw new Error(`foo`);
//   }
//   else throw new Error(`foo`);
// }

// export function testNonViolation2(s: string): number {
//   if (s === 'abc') return 5;
//   else return 18;
// }

// export function testNonViolation3(s: string): number {
//   if (s === 'abc') throw "abc";
//   return 5;
// }

// export function testNonViolation4(s: string): number {
//   if (s.length > 0) {
//     if (s === 'abc') throw "abc";
//   }
//   return 5;
// }

// export function testNonViolation5(s: string): number {
//   if (s.length > 0) {
//     // for this nested conditional, at least one branch returns unconditionally (actually two do), so all branches must return unconditionally or throw unconditionally, which they do:
//     if (s.length > 1) return 1;
//     else if (s.length > 2) throw "ok";
//     else return 0;
//   } else if (s.length > 3) return 0;
//   else if (s.length > 4) {
//     if (s.length > 5) throw "ok"; // this nested conditional if branch throws unconditionally, but no branch returns unconditionally, so it's not in violation
//     return 0; // this unconditional return causes the else if branch to be not in violation
//   } else if (s.length > 6) {
//     if (s.length > 7) throw "ok"; // this nested conditional if branch throws unconditionally, but no branch returns unconditionally, so it's not in violation
//     if (s.length > 8) return 0;
//     else throw "yy"; // here, the nested conditional else branch must return unconditionally or throw unconditionally because its if branch returns unconditionally, and it throws unconditionally 
//   } else throw "bar"; // here, the else branch must return unconditionally or throw unconditionally, and it throws unconditionally
// }

// export function testNonViolation6(s: string): number {
//   if (s.length > 0) return 0;
//   else throw "bar"; // here, the else branch must return unconditionally or throw unconditionally, and it throws unconditionally
// }

// export function testNonViolation7(s: string): void {
//   if (s.length > 0) throw "bar"; // here, the if branch throws unconditionally, but that does not trigger a requirement for an else branch to return unconditionally
// }

// export function testNonViolation8(s: string) {
//   if (s.length < 0) throw "foo";
//   else console.log(s); // no branch returns unconditionally and so there is no requirement for all branches to return unconditionally or throw unconditionally.
// }

// export function testNonViolation9(s: string) {
//   if (s.length < 0) throw "foo"; // no else branch is needed because the if branch does not unconditionally return.
// }

// export function testNonViolation10(s: string) {
//   if (s.length > 0) throw "baq"; // here, both conditional branches throw, and no branch returns unconditionally, so it is not in violation
//   else throw "boo";
// }

// export function testNonViolation11(s: string): number {
//   if (s.length > 0) {
//     {
//       console.log('hi');
//       return 7;
//     }
//   } else return 7;
// }

// export function testNonViolation12(s: string): number {
//   if (s.length > 0) {
//     {
//       throw "ok";
//     }
//   } else return 7;
// }

// export function testNonViolation13(s: string): number {
//   if (s.length > 0) {
//     {
//       if (s.length > 5) return 6;
//       else throw "ok";
//     }
//   } else return 7;
// }

// export function testNonViolation14(s: string): number {
//   if (s.length > 0) return 0;
//   else {
//     if (s.length > 1) throw "foo";
//     else return 13;
//   }
// }

// export function testNonViolation15(s: string): number {
//   for (const c of s) {
//     if (c === 'a') return 1;
//     else throw "ok";
//   }
//   return 0;
// }

// export function testNonViolation16(s: string): number {
//   if (s.length > 0) console.log('hi');
//   return 0;
// }

// export function testNonViolation17(s: string): number {
//   if (s.length > 0) {
//     console.log('hi');
//     {
//       return 1;
//     }
//   } else throw "ok";
// }

// export function testNonViolation18(s: string | null): number {
//   if (s !== null) try {
//     return 7;
//   } catch (e) {
//     return 13;
//   } else return 14;
// }

// export function testNonViolation19(s: string | null): number {
//   if (s !== null) try {
//     return 7;
//   } catch (e) {
//     throw "ok";
//   } else return 14;
// }

// export function testNonViolation20(s: string | null): number {
//   if (s !== null) return 14;
//   else try {
//     return 7;
//   } catch (e) {
//     throw "ok";
//   }
// }

// export function testNonViolation21(s: string | null): number {
//   if (s !== null) try {
//     return 7;
//   } catch (e) {
//     throw "ok";
//   } else return 14;
// }

// export function testNonViolation22(): number {
//   try {
//     throw "ok";
//   }
//   catch (e) {
//     console.log('info');
//   }
//   return 13;
// }

// export function testNonViolation23(): number {
//   try {
//     console.log('info');
//   }
//   catch (e) {
//     throw "ok";
//   }
//   return 13;
// }

// export function testNonViolation24(): number {
//   try {
//     throw "ok";
//   }
//   catch (e) {
//     return 5;
//   }
// }

// export function testNonViolation25(): number {
//   try {
//     return 5;
//   }
//   catch (e) {
//     throw "ok";
//   }
// }

// // ********************************************************
// // no-conditional-returns: examples of rule violations

// export function testViolation0(s: string): number {
//   if (s.length > 0) return 1;
//   return 0;
// }

// export function testViolation00(s: string): number {
//   if (s.length > 0) {
//     console.log('hi');
//     {
//       return 1;
//     }
//   }
//   return 0;
// }

// export function testViolation000a(s: string): number {
//   if (s.length > 0) {
//     console.log('hi');
//   } else {
//     if (s.length > 13) return 13;
//     else {
//       if (s.length > 15) return 7;
//       else throw "ok";
//     }
//   }
//   return 0;
// }

// export function testViolation1(s: string): number {
//   if (s.length > 0) return 1;
//   else if (s.length > 2) return 5;
//   else if (s.length > 3) console.info('hi');
//   else if (s.length > 7) return 5;
//   else return 7;
//   return 0;
// }

// export function testViolation2(s: string): number {
//   if (s.length > 0) console.log('hi');
//   else if (s.length > 7) return 5;
//   else console.log('foo');
//   return 0;
// }

// export function testViolation3(s: string): number {
//   if (s.length > 0) console.log('hi');
//   else if (s.length > 7) return 5;
//   else return 7;
//   return 0;
// }

// export function testViolation4(s: string): number {
//   if (s.length > 0) return 0;
//   else {
//     if (s.length > 1) throw "foo";
//     else console.log('hi'); // this rule violation example is important. Here, the nested conditional has no branch that returns unconditionally, so it is not in violation. However, the top-level conditional's if branch returns unconditionally, so its else branch must return unconditionally or throw unconditionally, but it doesn't return unconditionally (eg. no return statements) and it doesn't throw unconditionally because the nested else branch doesn't throw unconditionally.
//   }
//   return 0;
// }

// export function testViolation5(s: string): number {
//   if (s.length > 0) return 0;
//   else {
//     if (s.length > 1) throw "foo";
//     else if (s.length > 3) throw "ok";
//     else console.log('hi');
//   }
//   return 0;
// }

// export function testViolation6(s: string): number {
//   if (s.length > 0) {
//     {
//       console.log('hi');
//     }
//   } else return 7;
//   return 0;
// }

// export function testViolation7(s: string): number {
//   if (s.length > 0) console.log('hi');
//   else return 7;
//   return 0;
// }

// export function testViolation8(s: string): number {
//   if (s.length > 0) {
//     for (const c of s) {
//       if (c === 'a') return 1;
//       else throw "ok";
//     }
//   } else return 4;
//   return 0;
// }

// export function testViolation9(s: string): number {
//   if (s.length > 0) {
//     console.log('hi');
//   } else {
//     if (s.length > 13) return 13;
//     else {
//       if (s.length > 15) return 7;
//       else throw "ok";
//     }
//   }
//   return 0;
// }

// export function testViolation10(s: string): number {
//   if (s.length > 0) {
//     if (s.length > 13) return 13;
//     else {
//       if (s.length > 15) return 7;
//       else throw "ok";
//     }
//   } else console.log('hi');
//   return 0;
// }

// export function testViolation11(s: string | null): number {
//   if (s !== null) try {
//     return 7;
//   } catch (e) {
//     console.log('hi');
//   } else return 14;
//   return 0;
// }

// export function testViolation12(s: string | null): number {
//   if (s !== null) try {
//     console.log('hi');
//   } catch (e) {
//     return 7;
//   } else return 14;
//   return 0;
// }

// export function testViolation13(s: string | null): number {
//   if (s !== null) try {
//     console.log('hi');
//   } catch (e) {
//     return 7;
//   } else throw "ok";
//   return 0;
// }

// export function testViolation14(s: string | null): number {
//   if (s !== null) try {
//     console.log('hi');
//   } catch (e) {
//     return 7;
//   } else console.log('ok');
//   return 0;
// }

// export function testViolation15(s: string | null): number {
//   if (s !== null) try {
//     return 7;
//   } catch (e) {
//     console.log('hi');
//   } else console.log('ok');
//   return 0;
// }

// export function testViolation16(): number {
//   try {
//     return 7;
//   }
//   catch (e) {
//     console.log('info');
//   }
//   return 13;
// }

// export function testViolation17(): number {
//   try {
//     console.log('info');
//   }
//   catch (e) {
//     return 7;
//   }
//   return 13;
// }
