
// ---------------------------
//       Event Listener
// ---------------------------

export function clickNextInput (e) {
  if(e.currentTarget.nextElementSibling?.tagName==='INPUT')
    e.currentTarget.nextElementSibling.click();
}
