/**
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

function hello() {
    return 'Hello Apps Script!';
}
function showDataEntryForm() {
    const ui = SpreadsheetApp.getUi();
    const htmlOutput = HtmlService.createHtmlOutputFromFile('EntryForm')
        .setWidth(400)
        .setHeight(300);
    ui.showModalDialog(htmlOutput, 'データ入力');
}
function showEditForm() {
    const ui = SpreadsheetApp.getUi();
    const htmlOutput = HtmlService.createHtmlOutputFromFile('EditForm')
        .setWidth(400)
        .setHeight(300);
    ui.showModalDialog(htmlOutput, '修正');
}
function getOptions() {
  const settingsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('設定シート');
  const labels = settingsSheet.getRange('I2:I4').getValues();
  const values = settingsSheet.getRange('I2:I4').getValues();
  const options = labels.map((label, index) => {
    return {label: label[0], value: values[index][0]};
  });
  return options.filter(option => option.label && option.value);
}
function getDiscounts() {
  const settingsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('設定シート');
  const labels = settingsSheet.getRange('E2:E' + settingsSheet.getLastRow()).getValues();
  const values = settingsSheet.getRange('F2:F' + settingsSheet.getLastRow()).getValues();
  const options = labels.map((label, index) => {
    return {label: label[0], value: values[index][0]};
  });
  return options.filter(option => option.label && option.value);
}
function appendFormData(adultCount, childCount, selectedOptions) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('入力シート');
    const currentDate = new Date();
    const formattedDate = Utilities.formatDate(currentDate, 'GMT+9', 'yyyy-MM-dd HH:mm:ss');
    const currentLastRow = sheet.getLastRow();
    const nextRowNumber = currentLastRow - 1;
    const optionsString = (Array.isArray(selectedOptions) && selectedOptions.length > 0) 
                          ? selectedOptions.join(", ") 
                          : "";
    sheet.getRange(currentLastRow+1, 1).setValue(nextRowNumber);
    sheet.getRange(currentLastRow+1, 2).setValue(adultCount);
    sheet.getRange(currentLastRow+1, 3).setValue(childCount);
    sheet.getRange(currentLastRow+1, 4).setValue(formattedDate);
    sheet.getRange(currentLastRow+1, 9).setValue(optionsString);
}
function appendDiscountData(id, discount, target) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('入力シート');
    sheet.getRange(id + 2, 11).setValue(discount);
    sheet.getRange(id + 2, 12).setValue(target);
}
function showDiscountForm() {
    const ui = SpreadsheetApp.getUi();
    const htmlOutput = HtmlService.createHtmlOutputFromFile('DiscountForm')
        .setWidth(300)
        .setHeight(200);
    ui.showModalDialog(htmlOutput, '割引適用');
}
function showSettlementForm() {
    const ui = SpreadsheetApp.getUi();
    const htmlOutput = HtmlService.createHtmlOutputFromFile('SettlementForm')
        .setWidth(300)
        .setHeight(200);
    ui.showModalDialog(htmlOutput, '清算');
}
function calculateSettlement(id, discount = null, target = null) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('入力シート');
    const settingsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('設定シート');
    const adultPricePerMinute = settingsSheet
        .getRange('B2')
        .getValue();
    const childPricePerMinute = settingsSheet
        .getRange('B3')
        .getValue();
    const maxTime = settingsSheet.getRange('B5').getValue();
    const billingInterval = settingsSheet
        .getRange('B4')
        .getValue();
    const minPrice = settingsSheet.getRange('B6').getValue();
    const minTime = settingsSheet.getRange('B7').getValue();
    const tax = settingsSheet.getRange('B8').getValue();
    const rowIndex = findRowIndexByRoomNumber(sheet, id);
    const entryTime = new Date(sheet.getRange(rowIndex, 4).getValue());
    const exitTime = sheet.getRange(rowIndex, 5).getValue();
    const adultCount = sheet.getRange(rowIndex, 2).getValue();
    const childCount = sheet.getRange(rowIndex, 3).getValue();
    const options = sheet.getRange(rowIndex, 9).getValue();
    const getDiscount = sheet.getRange(rowIndex, 11).getValue();
    const getDiscountTarget = sheet.getRange(rowIndex, 12).getValue();
    let currentTime;
    if (exitTime && exitTime !== "") {
        currentTime = new Date(exitTime);
    } else {
        currentTime = new Date();
        const formattedCurrentTime = Utilities.formatDate(currentTime, 'GMT+9', 'yyyy-MM-dd HH:mm:ss');
        sheet.getRange(rowIndex, 5).setValue(formattedCurrentTime);
    }
    let diff = (currentTime.getTime() - entryTime.getTime()) / 60000;
    if (diff > maxTime) {
        diff = maxTime;
    }
    let totalPrice = 0;
    let adultTotalPrice = 0;
    let childTotalPrice = 0;
    let optionsTotal = 0;
    let discountAdultPrice = 0;
    let discountChildPrice = 0;
    let discountTotalPrice = 0;
    if (diff <= minTime) {
        diff = minTime;
        adultTotalPrice = adultCount * minPrice;
        childTotalPrice = childCount * (minPrice / 2);
        totalPrice = adultTotalPrice + childTotalPrice;
    }
    else {
        let minutesDiff = diff - minTime;
        minutesDiff = Math.ceil(minutesDiff / billingInterval);
        diff = minTime + (minutesDiff * billingInterval);
        adultTotalPrice =
            (adultCount * minPrice) + 
            (adultCount * adultPricePerMinute) * minutesDiff;
        childTotalPrice =
            (childCount * (minPrice / 2)) + 
            (childCount * childPricePerMinute) * minutesDiff;
        totalPrice = adultTotalPrice + childTotalPrice;
    }
    if (options) {
      const optionsValue = findRowByOptionsName(settingsSheet, options);
      optionsTotal = optionsValue.reduce((acc, val) => acc + parseFloat(val), 0);
      totalPrice = totalPrice + optionsTotal;
    }
    if (discount == null) {
        const discountValue = findRowByDiscountValue(settingsSheet, getDiscount);
        discount = discountValue;
        target = getDiscountTarget;
    }
    if (discount != null) {
        if (target == '大人のみ適用') {
          discountAdultPrice = (adultCount * adultPricePerMinute) * discount;
        } else if (target == '子供のみ適用') {
          discountChildPrice = (childCount * childPricePerMinute) * discount;
        } else {
          discountAdultPrice = (adultCount * adultPricePerMinute) * discount;
          discountChildPrice = (childCount * childPricePerMinute) * discount;
        }
        discountTotalPrice = discountAdultPrice + discountChildPrice;
        totalPrice = totalPrice - discountTotalPrice;
    }
    taxTotalPrice = Math.round(totalPrice * (1 + tax));
    sheet.getRange(rowIndex, 6).setValue(diff);
    sheet.getRange(rowIndex, 7).setValue(adultTotalPrice);
    sheet.getRange(rowIndex, 8).setValue(childTotalPrice);
    sheet.getRange(rowIndex, 10).setValue(optionsTotal);
    sheet.getRange(rowIndex, 13).setValue(discountTotalPrice);
    sheet.getRange(rowIndex, 14).setValue(totalPrice);
    sheet.getRange(rowIndex, 15).setValue(taxTotalPrice);
    return Math.round(totalPrice);
}
function findRowIndexByRoomNumber(sheet, id) {
    const data = sheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
        if (data[i][0] === id) {
            return i + 1;
        }
    }
    return -1;
}
function getCoupons() {
    const settingsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('設定シート');
    const couponRange = settingsSheet.getRange('E2:E').getValues();
    const coupons = [];
    for (let i = 0; i < couponRange.length; i++) {
        if (couponRange[i][0]) {
            coupons.push(couponRange[i][0]);
        }
    }
    return coupons;
}
function findRowByDiscountValue(sheet, discount) {
    const nameRange = sheet.getRange('E2:E' + sheet.getLastRow()).getValues();
    const valueRange = sheet.getRange('F2:F' + sheet.getLastRow()).getValues();
    for (let i = 0; i < nameRange.length; i++) {
        if (nameRange[i][0] === discount) {
            return valueRange[i][0];
        }
    }
    return -1;
}
function findRowByOptionsName(sheet, optionsName) {
    const nameRange = sheet.getRange('I2:I' + sheet.getLastRow()).getValues();
    const valueRange = sheet.getRange('J2:J' + sheet.getLastRow()).getValues();
    const optionsNames = convertStringToArray(optionsName);
    const values = [];
    for (let optionName of optionsNames) {
      for (let i = 0; i < nameRange.length; i++) {
        if (nameRange[i][0] === optionName) {
          values.push(valueRange[i][0]);
          break; // 名前が一致する最初の値を見つけたら、次のオプション名に移動します。
        }
      }
    }
    return values;
}
function convertStringToArray(str) {
    return str.split(',').map(item => item.trim());
}
console.log(hello());
