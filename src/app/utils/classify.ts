
/**
 * Simple rule-based document classification.
 * categories: "Receipt", "Invoice", "Business Card", "ID Card", "Academic", "Other"
 */

export type DocCategory = "Receipt" | "Invoice" | "Business Card" | "ID Card" | "Academic" | "Note" | "Other";

const RULES: Record<string, string[]> = {
    "Receipt": ["total", "tax", "amount", "cash", "credit card", "change", "subtotal", "purchase"],
    "Invoice": ["invoice", "bill to", "due date", "balance", "item description", "quantity"],
    "Business Card": ["email", "phone", "tel", "fax", "website", "company", "position"],
    "ID Card": ["identity", "license", "passport", "dob", "date of birth", "nationality", "sex"],
    "Academic": ["university", "school", "grade", "score", "student", "exam", "certificate", "diploma"],
    "Note": ["memo", "agenda", "minutes", "meeting", "todo", "idea"]
};

export function classifyDocument(text: string): DocCategory {
    if (!text) return "Other";

    const lowerText = text.toLowerCase();

    let maxScore = 0;
    let bestCategory: DocCategory = "Other";

    for (const [category, keywords] of Object.entries(RULES)) {
        let score = 0;
        for (const keyword of keywords) {
            if (lowerText.includes(keyword)) {
                score++;
            }
        }

        // Normalize score by keyword count to avoid bias? Simple count is usually fine for short docs.
        if (score > maxScore) {
            maxScore = score;
            bestCategory = category as DocCategory;
        }
    }

    // Threshold to avoid guessing on very weak signals
    if (maxScore < 2) return "Other";

    return bestCategory;
}
