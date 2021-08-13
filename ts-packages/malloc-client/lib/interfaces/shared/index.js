"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionWithPromiseResultFlag = exports.SpecialAccountType = void 0;
/********** Special Accounts **************/
var SpecialAccountType;
(function (SpecialAccountType) {
    SpecialAccountType["KeyPair"] = "KEY_PAIR";
    SpecialAccountType["WebConnected"] = "WEB_CONNECTED";
})(SpecialAccountType = exports.SpecialAccountType || (exports.SpecialAccountType = {}));
var TransactionWithPromiseResultFlag;
(function (TransactionWithPromiseResultFlag) {
    TransactionWithPromiseResultFlag["SUCCESS"] = "success";
    TransactionWithPromiseResultFlag["FAILURE"] = "failure";
    TransactionWithPromiseResultFlag["PENDING"] = "pending";
})(TransactionWithPromiseResultFlag = exports.TransactionWithPromiseResultFlag || (exports.TransactionWithPromiseResultFlag = {}));
