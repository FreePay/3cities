
// TODO this needs a whole revamp, eg. to expose introspectable details about variables to generate a help file

const ControlChar = "~";

type Variables =
  "R" // payment transaction receipt URL
  ;

export function applyVariableSubstitutions(s: string, substitutions: { [v in Variables]: string }): string {
  let result = s;
  Object.entries(substitutions).forEach(([key, value]) => {
    result = result.replace(new RegExp(`${ControlChar}${key}${ControlChar}`, 'g'), value);
  });
  return result;
}
