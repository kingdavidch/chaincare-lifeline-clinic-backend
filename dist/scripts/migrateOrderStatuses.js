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
exports.migrateOrderStatuses = void 0;
const order_model_1 = __importDefault(require("../order/order.model"));
const migrateOrderStatuses = () => __awaiter(void 0, void 0, void 0, function* () {
    console.log("🔄 Running order status migration...");
    try {
        // Update tests.status
        yield order_model_1.default.updateMany({ "tests.status": { $in: ["awaiting_result", "sent"] } }, [
            {
                $set: {
                    tests: {
                        $map: {
                            input: "$tests",
                            as: "t",
                            in: {
                                $mergeObjects: [
                                    "$$t",
                                    {
                                        status: {
                                            $switch: {
                                                branches: [
                                                    {
                                                        case: { $eq: ["$$t.status", "awaiting_result"] },
                                                        then: "processing"
                                                    },
                                                    {
                                                        case: { $eq: ["$$t.status", "sent"] },
                                                        then: "result_sent"
                                                    }
                                                ],
                                                default: "$$t.status"
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            }
        ]);
        // Update tests.statusHistory
        yield order_model_1.default.updateMany({ "tests.statusHistory.status": { $in: ["awaiting_result", "sent"] } }, [
            {
                $set: {
                    tests: {
                        $map: {
                            input: "$tests",
                            as: "t",
                            in: {
                                $mergeObjects: [
                                    "$$t",
                                    {
                                        statusHistory: {
                                            $map: {
                                                input: "$$t.statusHistory",
                                                as: "sh",
                                                in: {
                                                    $mergeObjects: [
                                                        "$$sh",
                                                        {
                                                            status: {
                                                                $switch: {
                                                                    branches: [
                                                                        {
                                                                            case: {
                                                                                $eq: [
                                                                                    "$$sh.status",
                                                                                    "awaiting_result"
                                                                                ]
                                                                            },
                                                                            then: "processing"
                                                                        },
                                                                        {
                                                                            case: { $eq: ["$$sh.status", "sent"] },
                                                                            then: "result_sent"
                                                                        }
                                                                    ],
                                                                    default: "$$sh.status"
                                                                }
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            }
        ]);
        console.log("✅ Order status migration completed successfully.");
    }
    catch (err) {
        console.error("❌ Migration failed:", err);
    }
});
exports.migrateOrderStatuses = migrateOrderStatuses;
