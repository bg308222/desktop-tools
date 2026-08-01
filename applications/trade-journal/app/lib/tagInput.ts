/**
 * 判斷這次 input 事件是「從建議清單選取」而非逐字輸入——選取當下就該直接上標籤，
 * 不必再按一次 Enter。
 *
 * 瀏覽器對 datalist 選取回報的 inputType 並不一致：Chrome 給 insertReplacementText，
 * Firefox 給 undefined；逐字輸入則是 insertText／deleteContentBackward 等。
 * 另外要求值必須完全命中既有標籤，避免手動打完整個名字時被誤判成選取。
 */
export function isPickedFromList(
  inputType: string | undefined | null,
  value: string,
  knownNames: string[],
): boolean {
  const picked = inputType == null || inputType === 'insertReplacementText'
  return picked && knownNames.includes(value.trim())
}
