const WEAK=new Set(['changeme!2026','password','password123','12345678','123456789','1234567890','qwerty123']);
/** Returns an error message, or null when the password is acceptable. */
export function passwordProblem(password:string,username:string):string|null{
  if(password.length<10)return 'Password must be at least 10 characters';
  if(!/[A-Za-z]/.test(password)||!/\d/.test(password))return 'Password must contain both letters and numbers';
  if(password.toLowerCase().includes(username.toLowerCase()))return 'Password must not contain the username';
  if(WEAK.has(password.toLowerCase()))return 'This password is too common';
  return null;
}
