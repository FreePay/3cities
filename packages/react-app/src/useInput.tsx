import React, { InputHTMLAttributes, useState } from 'react';

interface Opts {
  onEnterKeyPress?: () => void;
}

// https://stackoverflow.com/questions/55757761/handle-an-input-with-react-hooks
export function useInput(initialValue: number, inputHTMLAttributes: InputHTMLAttributes<HTMLInputElement>, opts?: Opts): [number, JSX.Element, (newValue: number) => void];
export function useInput(initialValue: string, inputHTMLAttributes: InputHTMLAttributes<HTMLInputElement>, opts?: Opts): [string, JSX.Element, (newValue: string) => void];
export function useInput(initialValue: boolean, inputHTMLAttributes: InputHTMLAttributes<HTMLInputElement>, opts?: Opts): [boolean, JSX.Element, (newValue: boolean) => void];
export function useInput(initialValue: boolean | string | number, inputHTMLAttributes: InputHTMLAttributes<HTMLInputElement>, opts?: Opts): [
  boolean | string | number, // current value of the input
  JSX.Element, // input React element for user to type into
  ((newValue: boolean) => void) | ((newValue: string) => void) | ((newValue: number) => void), // setValue function for client to set the input value. Here we order setValue last in this return type because while every client needs the current value and input React element, some clients don't need setValue and may omit it by ignoring the 3rd array element in the callsite destructure
] {
  const [value, setValue] = useState(initialValue);
  const input = <input
    value={typeof value !== 'boolean' ? value : undefined}
    checked={typeof value === 'boolean' ? value : undefined}
    onChange={(e): void => {
      if (inputHTMLAttributes.type === "checkbox") setValue(e.target.checked);
      else setValue(e.target.valueAsNumber || e.target.value);
    }}
    onKeyDown={(e) => {
      const isEnterKey = (e.key === 'Enter') || (e.keyCode === 13); // e.keyCode is deprecated and the correct API is now e.key, but we check both to ensure backwards compatibilty. For a list of possible values of e.key, see https://www.w3.org/TR/uievents-key/#named-key-attribute-values
      if (isEnterKey && opts && opts.onEnterKeyPress !== undefined) {
        opts.onEnterKeyPress();
      }
    }}
    {...inputHTMLAttributes}
  />;
  return [value, input, setValue];
}
