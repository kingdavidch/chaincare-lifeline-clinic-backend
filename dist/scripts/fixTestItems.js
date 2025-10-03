"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fixTestData = fixTestData;
const test_item_model_1 = __importDefault(require("../test/test.item.model"));
const test_model_1 = __importDefault(require("../test/test.model"));
function fixTestData() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            try {
                yield test_item_model_1.default.collection.dropIndex("name_1");
                console.log("🗑️ Dropped old index name_1");
            }
            catch (err) {
                if (err.codeName === "IndexNotFound") {
                    console.log("ℹ️ name_1 index already removed");
                }
                else {
                    console.error("⚠️ Error dropping index:", err.message);
                }
            }
            yield test_item_model_1.default.syncIndexes();
            console.log("✅ Synced compound index (clinic + name)");
            const orphanItems = yield test_item_model_1.default.find({ clinic: { $exists: false } });
            console.log(`🔍 Found ${orphanItems.length} orphan test items`);
            for (const item of orphanItems) {
                const test = yield test_model_1.default.findOne({ testName: item.name });
                if (test) {
                    item.clinic = test.clinic;
                    yield item.save();
                    console.log(`📌 Fixed orphan TestItem "${item.name}" → clinic ${test.clinic}`);
                }
                else {
                    console.log(`⚠️ Skipped orphan "${item.name}" (no test found)`);
                }
            }
            const tests = yield test_model_1.default.find({ testItem: { $exists: false } });
            console.log(`🔍 Found ${tests.length} tests missing testItem`);
            for (const test of tests) {
                let item = yield test_item_model_1.default.findOne({
                    clinic: test.clinic,
                    name: test.testName.toLowerCase()
                });
                if (!item) {
                    item = yield test_item_model_1.default.create({
                        clinic: test.clinic,
                        name: test.testName.toLowerCase(),
                        image: "",
                        icon: ""
                    });
                    console.log(`📌 Created TestItem "${test.testName}" for clinic ${test.clinic}`);
                }
                test.testItem = item._id;
                yield test.save();
                console.log(`✅ Linked Test "${test.testName}" → TestItem ${item._id}`);
            }
            console.log("🎉 Finished fixing test + testItems");
        }
        catch (err) {
            console.error("❌ Failed fixing test data:", err);
        }
    });
}
