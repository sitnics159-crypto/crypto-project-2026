# Financial validation regression cases

Required acceptance cases for the financial core. These are specifications, not executed application tests.

- Accept unsigned decimal integer strings, including zero and uint256 maximum.
- Reject negative amounts, whitespace, hexadecimal, exponent notation, booleans, arrays and unsafe numeric integers.
- Accept token decimals 0 through 255; reject all other values.
- Preserve exact ERC-20 amounts in UI and CSV, including decimals=0.
- Show positive USD fees below one cent as less than $0.01, not zero.
- Reject invalid gas operands before multiplication.
- Keep CSP script hash synchronized with the modified inline script.
- Run deterministic tests and browser smoke tests before merge.
