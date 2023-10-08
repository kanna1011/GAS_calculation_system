/**
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
export function hello() {
  return 'Hello Apps Script!';
}
// 新規入力フォーム
export function showDataEntryForm() {
  const ui = SpreadsheetApp.getUi();

  const htmlOutput = HtmlService.createHtmlOutputFromFile('EntryForm')
    .setWidth(400)
    .setHeight(300);

  ui.showModalDialog(htmlOutput, 'データ入力');
}
// 入力フォームの値を新規行に挿入
export function appendFormData(
  adultCount: number,
  childCount: number,
  couponSetting: string
) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const currentDate = new Date();
  const formattedDate = Utilities.formatDate(
    currentDate,
    'GMT+9',
    'yyyy-MM-dd HH:mm:ss'
  );

  // 現在の行数を取得し、その次の行の番号を計算
  const currentLastRow = sheet.getLastRow();
  const nextRowNumber = currentLastRow - 1; // 3行目から開始するため、2を減算する

  // 新しい行にデータを追加する際に、先頭の列に行番号をセット
  sheet.appendRow([
    nextRowNumber,
    adultCount,
    childCount,
    couponSetting,
    formattedDate,
  ]);
}
// 清算用番号入力フォーム
export function showSettlementForm() {
  const ui = SpreadsheetApp.getUi();
  const htmlOutput = HtmlService.createHtmlOutputFromFile('SettlementForm')
    .setWidth(300)
    .setHeight(200);
  ui.showModalDialog(htmlOutput, '清算');
}
// 料金を精算し出力
export function calculateSettlement(id: number): number {
  const sheet: GoogleAppsScript.Spreadsheet.Sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
      '入力シート'
    ) as GoogleAppsScript.Spreadsheet.Sheet;
  const settingsSheet: GoogleAppsScript.Spreadsheet.Sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
      '設定シート'
    ) as GoogleAppsScript.Spreadsheet.Sheet;

  // 設定値の取得
  // 大人料金
  const adultPricePerMinute: number = settingsSheet
    .getRange('B2')
    .getValue() as number;
  // 子供料金
  const childPricePerMinute: number = settingsSheet
    .getRange('B3')
    .getValue() as number;
  // 最大時間
  const maxTime: number = settingsSheet.getRange('B5').getValue() as number;
  // 単位
  const billingInterval: number = settingsSheet
    .getRange('B4')
    .getValue() as number;
  // 最小時間金額
  const minPrice: number = settingsSheet.getRange('B6').getValue() as number;
  // 最小時間
  const mintime: number = settingsSheet.getRange('B7').getValue() as number;
  // 税率
  const tax: number = settingsSheet.getRange('B8').getValue() as number;

  // 入室情報の取得
  const rowIndex: number = findRowIndexByRoomNumber(sheet, id);
  const entryTime: Date = new Date(
    sheet.getRange(rowIndex, 5).getValue() as string
  ); // 入室時間
  const adultCount: number = sheet.getRange(rowIndex, 2).getValue() as number; // 大人人数
  const childCount: number = sheet.getRange(rowIndex, 3).getValue() as number; // 子供人数
  const coupon: string = sheet.getRange(rowIndex, 4).getValue() as string; // クーポン

  // 料金計算
  const currentTime: Date = new Date();
  let minutesDiff: number =
    (currentTime.getTime() - entryTime.getTime()) / 60000;
  // 最大時間を超える場合は最大時間に設定
  if (minutesDiff > maxTime) {
    minutesDiff = maxTime;
  }

  let totalPrice: number = 0;

  if (minutesDiff <= mintime) {
    totalPrice = (adultCount + childCount) * minPrice;
  } else {
    // 最小時間以上の場合、超過分を計算して加算
    minutesDiff = minutesDiff - mintime;
    // n分ごとの切り上げ計算
    minutesDiff = Math.ceil(minutesDiff / billingInterval);
    totalPrice =
      (adultCount + childCount) * minPrice +
      (adultCount * adultPricePerMinute + childCount * childPricePerMinute) *
        minutesDiff;
  }

  // 税金を加える
  totalPrice = totalPrice * (1 + tax);

  // クーポンが選択されている場合の割引計算
  if (coupon) {
    // クーポン名から行番号を取得
    const couponRow: number = findRowByCouponName(settingsSheet, coupon);
    // 割引率を取得
    const discountRate: number = settingsSheet
      .getRange(couponRow, 6)
      .getValue() as number; // F列を指定
    totalPrice = totalPrice * (1 - discountRate);
  }

  // 指定した行の5列目に退出時間（計算で使用した現在時間）を出力
  const formattedCurrentTime: string = Utilities.formatDate(
    currentTime,
    'GMT+9',
    'yyyy-MM-dd HH:mm:ss'
  );
  sheet.getRange(rowIndex, 6).setValue(formattedCurrentTime);

  // 6列目に生成した金額を出力
  sheet.getRange(rowIndex, 7).setValue(Math.round(totalPrice));

  return Math.round(totalPrice);
}

export function findRowIndexByRoomNumber(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  id: number
) {
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === id) {
      return i + 1;
    }
  }
  return -1; // 該当する行が見つからなかった場合
}
// クーポン情報を動的に取得
export function getCoupons(): string[] {
  const settingsSheet: GoogleAppsScript.Spreadsheet.Sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
      '設定シート'
    ) as GoogleAppsScript.Spreadsheet.Sheet;
  const couponRange = settingsSheet.getRange('E2:E').getValues();
  const coupons: string[] = [];

  for (let i = 0; i < couponRange.length; i++) {
    if (couponRange[i][0]) {
      coupons.push(couponRange[i][0]);
    }
  }

  return coupons;
}
// クーポン名から行番号を探す関数
function findRowByCouponName(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  couponName: string
): number {
  const data = sheet.getRange('E2:E' + sheet.getLastRow()).getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === couponName) {
      return i + 2; // +2 は E2 からスタートしているため
    }
  }
  return -1; // 該当する行が見つからなかった場合
}
