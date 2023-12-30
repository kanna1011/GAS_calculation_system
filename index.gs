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
/**
 * オプション
 */
function prepareDataForEditForm(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('入力シート');
  const settingsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('設定シート');
  const rowIndex = findRowIndexByRoomNumber(sheet, id);
  const setOptionsString = sheet.getRange(rowIndex, 9).getValue();
  let optionsData;
  if (setOptionsString) {
    // setOptionsStringがnullでない場合、optionsDataを計算
    optionsData = optionsStringSplit(setOptionsString);
  } else {
    // setOptionsStringがnullの場合、optionsDataはnull
    optionsData = null;
  }
  const lastRow = getLastRowOfColumn(settingsSheet, 9);
  const settingOptions = settingsSheet.getRange('I2:I' + lastRow).getValues();
  return { optionsData, settingOptions };
}
/**
 * 設定シートからオプション項目を取得
 */
function getOptions() {
  const settingsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('設定シート');
  const lastRow = getLastRowOfColumn(settingsSheet, 9);
  const labels = settingsSheet.getRange('I2:I' + lastRow).getValues();
  const values = settingsSheet.getRange('I2:I' + lastRow).getValues();
  const options = labels.map((label, index) => {
    return {label: label[0], value: values[index][0]};
  });
  return options.filter(option => option.label && option.value);
}
/**
 * 設定シートから割引項目を取得
 */
function getDiscounts() {
  const settingsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('設定シート');
  const labels = settingsSheet.getRange('E2:E' + settingsSheet.getLastRow()).getValues();
  const values = settingsSheet.getRange('F2:F' + settingsSheet.getLastRow()).getValues();
  const options = labels.map((label, index) => {
    return {label: label[0], value: values[index][0]};
  });
  return options.filter(option => option.label && option.value);
}
/**
 * 画面から取得した内容をシートに入力
 */
function appendFormData(adultCount, childCount, selectedOptions) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('入力シート');
    const currentDate = new Date();
    const formattedDate = Utilities.formatDate(currentDate, 'JST', 'yyyy/MM/dd HH:mm:ss');
    const currentLastRow = sheet.getLastRow();
    const nextRowNumber = currentLastRow - 1;
    const optionsString = selectedOptions.map(option => `${option.label}:${option.count}`).join(",");
    const qrDocment = createDocumentWithQrCodeAndData(nextRowNumber, formattedDate);
    sheet.getRange(currentLastRow+1, 1).setValue(nextRowNumber);
    sheet.getRange(currentLastRow+1, 2).setValue(adultCount);
    sheet.getRange(currentLastRow+1, 3).setValue(childCount);
    sheet.getRange(currentLastRow+1, 4).setValue(formattedDate);
    sheet.getRange(currentLastRow+1, 9).setValue(optionsString);
    sheet.getRange(currentLastRow+1, 16).setValue(qrDocment);
    return qrDocment;
}
/**
 * オプションの変更
 */
function editOptions(id, selectedOptions) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('入力シート');
  const rowIndex = findRowIndexByRoomNumber(sheet, id);
  const optionsString = selectedOptions.map(option => `${option.label}:${option.count}`).join(",");
  const entryTime = new Date(sheet.getRange(rowIndex, 4).getValue());
  const formattedDate = Utilities.formatDate(entryTime, 'JST', 'yyyy/MM/dd HH:mm:ss');
  const qrDocment = createDocumentWithQrCodeAndData(id, formattedDate);

  sheet.getRange(rowIndex, 9).setValue(optionsString);
  sheet.getRange(rowIndex, 16).setValue(qrDocment);
  return qrDocment;
}
/**
 * 設定した割引内容をシートに入力
 */
function appendDiscountData(id, discount, target) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('入力シート');
    const rowIndex = findRowIndexByRoomNumber(sheet, id);
    sheet.getRange(rowIndex, 11).setValue(discount);
    sheet.getRange(rowIndex, 12).setValue(target);
}
/**
 * 割引設定画面表示
 */
function showDiscountForm() {
    const ui = SpreadsheetApp.getUi();
    const htmlOutput = HtmlService.createHtmlOutputFromFile('DiscountForm')
        .setWidth(300)
        .setHeight(200);
    ui.showModalDialog(htmlOutput, '割引適用');
}
/**
 * 清算画面表示
 */
function showSettlementForm() {
    const ui = SpreadsheetApp.getUi();
    const htmlOutput = HtmlService.createHtmlOutputFromFile('SettlementForm')
        .setWidth(300)
        .setHeight(200);
    ui.showModalDialog(htmlOutput, '清算');
}
/**
 * 清算処理
 */
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
    const daysMaxPrice = settingsSheet.getRange('B9').getValue();
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
    // 計算用初期値
    let totalPrice = 0;
    let adultPrice = 0;
    let childPrice = 0;
    let adultTotalPrice = 0;
    let childTotalPrice = 0;
    let optionsTotal = 0;
    let discountAdultPrice = 0;
    let discountChildPrice = 0;
    let discountTotalPrice = 0;
    // 差分確認
    if (diff <= minTime) {
        diff = minTime;
        adultTotalPrice = adultCount * minPrice;
        childTotalPrice = childCount * (minPrice / 2);
        totalPrice = adultTotalPrice + childTotalPrice;
    } else {
        let minutesDiff = diff - minTime;
        minutesDiff = Math.ceil(minutesDiff / billingInterval);
        diff = minTime + (minutesDiff * billingInterval);
        adultPrice = minPrice + (adultPricePerMinute * minutesDiff);
        childPrice = (minPrice / 2) + (childPricePerMinute * minutesDiff);
        if (adultPrice <= daysMaxPrice) {
          adultTotalPrice = adultPrice * adultCount;
        } else {
          adultTotalPrice = daysMaxPrice * adultCount;
        }
        if (childPrice <= (daysMaxPrice / 2)) {
          childTotalPrice = childPrice * childCount;
        } else {
          childTotalPrice = (daysMaxPrice / 2) * childCount;
        }
        totalPrice = adultTotalPrice + childTotalPrice;
    }
    // オプション処理
    if (options) {
      optionsTotal = calculateOptionsTotal(settingsSheet, options);
      totalPrice = totalPrice + optionsTotal;
    }
    // 割引処理
    if (discount == null) {
        const discountValue = findRowByDiscountValue(settingsSheet, getDiscount);
        discount = discountValue;
        target = getDiscountTarget;
    }
    if (discount != null) {
      if (diff <= ( discount * billingInterval)) {
        if (target == '大人のみ適用') {
          discountAdultPrice = adultTotalPrice;
        } else if (target == '子供のみ適用') {
          discountChildPrice = childTotalPrice;
        } else {
          discountAdultPrice = adultTotalPrice;
          discountChildPrice = childTotalPrice;
        }
        discountTotalPrice = discountAdultPrice + discountChildPrice;
        totalPrice = totalPrice - discountTotalPrice;
      } else {
        if (target == '大人のみ適用') {
          discountAdultPrice = (adultCount * adultPricePerMinute) * discount;
        } else if (target == '子供のみ適用') {
          discountChildPrice = (childCount * childPricePerMinute) * discount;
        } else {
          discountAdultPrice = (adultCount * adultPricePerMinute) * discount;
          discountChildPrice = (childCount * childPricePerMinute) * discount;
        }
        discountTotalPrice = discountAdultPrice + discountChildPrice;
        if (totalPrice < discountTotalPrice) {
          discountTotalPrice = totalPrice;
        }
        totalPrice = totalPrice - discountTotalPrice;
      }
    }
    // シート反映
    taxTotalPrice = Math.round(totalPrice * (1 + tax));
    sheet.getRange(rowIndex, 6).setValue(diff);
    sheet.getRange(rowIndex, 7).setValue(adultTotalPrice);
    sheet.getRange(rowIndex, 8).setValue(childTotalPrice);
    sheet.getRange(rowIndex, 10).setValue(optionsTotal);
    sheet.getRange(rowIndex, 13).setValue(discountTotalPrice);
    sheet.getRange(rowIndex, 14).setValue(totalPrice);
    sheet.getRange(rowIndex, 15).setValue(taxTotalPrice);

    const createDoc = createDocumentWithCalcData(id);
    sheet.getRange(rowIndex, 17).setValue(createDoc);

    return createDoc;
}
/**
 * 清算結果ドキュメントを作成
 */
function createDocumentWithCalcData(id) {
    const doc = DocumentApp.create('Liquidation for ' + id);
    const body = doc.getBody();
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('入力シート');
    const rowIndex = findRowIndexByRoomNumber(sheet, id);
    const adultCount = sheet.getRange(rowIndex, 2).getValue();
    const childCount = sheet.getRange(rowIndex, 3).getValue();
    const enterTime = sheet.getRange(rowIndex, 4).getValue();
    const exitTime = sheet.getRange(rowIndex, 5).getValue();
    const calcTime = sheet.getRange(rowIndex, 6).getValue();
    const adultPrice = sheet.getRange(rowIndex, 7).getValue();
    const childPrice = sheet.getRange(rowIndex, 8).getValue();
    const option = sheet.getRange(rowIndex, 9).getValue();
    const optionPrice = sheet.getRange(rowIndex, 10).getValue();
    const discountPrice = sheet.getRange(rowIndex, 13).getValue();
    const totalPrice = sheet.getRange(rowIndex, 14).getValue();
    const totalPriceTax = sheet.getRange(rowIndex, 15).getValue();

    // 日付のフォーマット
    const formattedEnterTime = Utilities.formatDate(enterTime, 'JST', 'yyyy/MM/dd HH:mm:ss');
    const formattedExitTime = Utilities.formatDate(exitTime, 'JST', 'yyyy/MM/dd HH:mm:ss');

    // 金額のフォーマット（カンマ区切り）
    const formattedAdultPrice = adultPrice.toLocaleString();
    const formattedChildPrice = childPrice.toLocaleString();
    const formattedOptionPrice = optionPrice.toLocaleString();
    const formattedDiscountPrice = discountPrice.toLocaleString();
    const formattedTotalPrice = totalPrice.toLocaleString();
    const formattedTotalPriceTax = totalPriceTax.toLocaleString();
  
    var enterLabelText = body.appendParagraph("入室時間　　　　　　: ");
    var enterText = body.appendParagraph(formattedEnterTime);
    var exitLabelText = body.appendParagraph("退出時間　　　　　　: ");
    var exitText = body.appendParagraph(formattedExitTime);
    body.appendParagraph(" ");
    var calcTimeText = body.appendParagraph("清算時間　　　　　　: " + calcTime + "分");
    body.appendParagraph(" ");
    var adultCountText = body.appendParagraph("大人の数　　　　　　: " + adultCount + "人");
    var childCountText = body.appendParagraph("子供の数　　　　　　: " + childCount + "人");
    body.appendParagraph(" ");
    var optionLabelText = body.appendParagraph("選択されたオプション：");
    var optionText = body.appendParagraph(option);
    body.appendParagraph(" ");
    var adultPriceText = body.appendParagraph("大人の料金　　　　　: " + formattedAdultPrice + "円");
    var childPriceText = body.appendParagraph("子供の料金　　　　　: " + formattedChildPrice + "円");
    var optionPriceText = body.appendParagraph("オプション料金　　　: " + formattedOptionPrice + "円");
    var discountPriceText = body.appendParagraph("割引料金　　　　　　: " + formattedDiscountPrice + "円");
    var dotText = body.appendParagraph("----------------------------------------------");
    var totalPriceText = body.appendParagraph("合計料金　　　　　　: " + formattedTotalPrice + "円");
    var totalPriceTaxText = body.appendParagraph("税込料金　　　　　　: " + formattedTotalPriceTax + "円");
    // テキストサイズ設定
    const textFontSize = 27;
    enterLabelText.editAsText().setFontSize(textFontSize);
    enterText.editAsText().setFontSize(textFontSize);
    exitLabelText.editAsText().setFontSize(textFontSize);
    exitText.editAsText().setFontSize(textFontSize);
    calcTimeText.editAsText().setFontSize(textFontSize);
    adultCountText.editAsText().setFontSize(textFontSize);
    childCountText.editAsText().setFontSize(textFontSize);
    optionText.editAsText().setFontSize(textFontSize);
    optionLabelText.editAsText().setFontSize(textFontSize);
    adultPriceText.editAsText().setFontSize(textFontSize);
    childPriceText.editAsText().setFontSize(textFontSize);
    optionPriceText.editAsText().setFontSize(textFontSize);
    discountPriceText.editAsText().setFontSize(textFontSize);
    dotText.editAsText().setFontSize(textFontSize);
    dotText.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    totalPriceText.editAsText().setFontSize(textFontSize);
    totalPriceTaxText.editAsText().setFontSize(textFontSize);

    const file = DriveApp.getFileById(doc.getId());
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
    return doc.getUrl();
}
/**
 * 番号から行数を特定
 */
function findRowIndexByRoomNumber(sheet, id) {
    const data = sheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
        if (data[i][0] === id) {
            return i + 1;
        }
    }
    return -1;
}
/**
 * 割引項目名から値を取得
 */
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
/**
 * オプション料金の合計を取得
 */
function calculateOptionsTotal(sheet, optionsString) {
  const optionsData = optionsStringSplit(optionsString);

  // 各オプションに対して価格を探し、合計を計算する
  let optionsTotal = 0;
  for (let { label, count } of optionsData) {
    const price = findOptionPriceByName(sheet, label);
    if (price) {
      optionsTotal += (price * count);
    }
  }

  return optionsTotal;
}
/**
 * "label:count,label:count" 形式の文字列を分割してオプションの配列に変換する
 */
function optionsStringSplit(optionsString) {
  const optionsPairs = optionsString.split(',');  
  const optionsData = optionsPairs.map(pair => {
    const [label, count] = pair.split(':');
    return { label, count: parseInt(count, 10) };
  });
  return optionsData;
}
/**
 * オプション名からオプション料金を取得
 */
function findOptionPriceByName(sheet, optionName) {
  const lastRow = getLastRowOfColumn(sheet, 9);
  const nameRange = sheet.getRange('I2:I' + lastRow).getValues();
  const valueRange = sheet.getRange('J2:J' + lastRow).getValues();
  
  for (let i = 0; i < nameRange.length; i++) {
    if (nameRange[i][0] === optionName) {
      return parseFloat(valueRange[i][0]);
    }
  }
  return null; // オプションが見つからない場合はnullを返す
}
/**
 * ,カンマ区切りの文字列を配列に変換
 */
function convertStringToArray(str) {
    return str.split(',').map(item => item.trim());
}
/**
 * QRコードのドキュメントを作成
 */
function createDocumentWithQrCodeAndData(nextRowNumber, formattedDate) {
    const doc = DocumentApp.create('QR Code for ' + nextRowNumber);
    const body = doc.getBody();
    const qrBlob = generateQrCode(nextRowNumber.toString());
    body.appendImage(qrBlob).setHeight(600).setWidth(600);
    var paragraph = body.appendParagraph("入室時間: " + formattedDate);
    paragraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER); // 中央揃え
    paragraph.editAsText().setFontSize(30);

    // ファイルの共有設定
    const file = DriveApp.getFileById(doc.getId());
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return doc.getUrl();
}


/**
 * QRコードを作成
 */
function generateQrCode(data) {
    const url = "https://chart.googleapis.com/chart?chs=150x150&cht=qr&chl=" + data;
    const response = UrlFetchApp.fetch(url);
    return response.getBlob();
}
/**
 * Webアプリケーション初期画面設定
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Home')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
/**
 * 指定の画面表示
 */
function loadHtml(filename) {
  var htmlOutput = HtmlService.createTemplateFromFile(filename).evaluate()
    .setTitle('sample') // 任意のタイトルを設定
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  return htmlOutput.getContent();
}
/**
 * シート内容を取得
 */
function getSpreadsheetData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('入力シート');
  const headerRange = sheet.getRange("A2:Q2");
  const lastRow = sheet.getLastRow();
  const dataRange = sheet.getRange("A3:Q" + lastRow);
  const headerValues = headerRange.getValues().map(function(row) {
    return row.map(function(cell) { return String(cell); });
  });
  const dataValues = dataRange.getValues().map(function(row, rowIndex) {
    return row.map(function(cell, columnIndex) {
      // 4列目と5列目が日付データを含む
      if ((columnIndex === 3 || columnIndex === 4) && cell instanceof Date) {
        // 日付データをJSTに変換して整形
        return Utilities.formatDate(cell, 'JST', 'yyyy/MM/dd HH:mm:ss');
      } else {
        return String(cell);
      }
    });
  });

  return headerValues.concat(dataValues);
}
/**
 * 指定列の最終行を取得
 */
function getLastRowOfColumn(sheet, column) {
  // 指定した列のデータ範囲を取得します
  var dataRange = sheet.getRange(1, column, sheet.getMaxRows());
  var values = dataRange.getValues(); // 二次元配列として値を取得

  // valuesを逆順でループし、最初の非空の値が見つかった場所を返します
  for (var i = values.length - 1; i >= 0; i--) {
    if (values[i][0] !== "") { // 二次元配列のため、[i][0]をチェック
      return i + 1; // インデックスは0から始まるため、行番号に合わせて1を加算
    }
  }
  return 0; // もし全てのセルが空なら0を返します
}
/**
 * データベースシートにデータを移行
 */
function moveDataToDatabase() {
  var sourceSpreadsheet = SpreadsheetApp.getActiveSpreadsheet(); // 現在のスプレッドシート
  var sourceSheet = sourceSpreadsheet.getSheetByName('入力シート'); // データが含まれているシート
  var lastRow = sourceSheet.getLastRow(); // 最後の行番号を取得

  // データの範囲を取得
  var range = sourceSheet.getRange(3, 2, lastRow - 2, 14);
  var data = range.getValues(); // データを2次元配列として取得

  // データベーススプレッドシートを開く（ファイルIDを指定）
  var databaseSpreadsheet = SpreadsheetApp.openById('1d0kqlTtM0pnKwzIyld4OiVdkfNYVEGwmRmBuNXNhI1w');
  var databaseSheet = databaseSpreadsheet.getSheetByName('データベース'); // データベースシートを指定

  // 5列目にデータが入っているかチェック
  for (var i = 0; i < data.length; i++) {
    if (data[i][3] === '') {
      throw new Error("清算が完了していないデータが存在します（番号: " + (i + 1) + "）");
    }
  }

  // データを新しいスプレッドシートに書き込む
  var nextEmptyRow = databaseSheet.getLastRow() + 1; // データベースシートの次の空の行を取得
  databaseSheet.getRange(nextEmptyRow, 1, data.length, data[0].length).setValues(data);

  // 元のスプレッドシートのデータをクリアする（必要に応じて）
  var clearRange = sourceSheet.getRange(3, 1, lastRow - 1, 17);
  clearRange.clear();
}
console.log(hello());