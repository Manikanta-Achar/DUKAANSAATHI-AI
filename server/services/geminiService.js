import { GoogleGenAI } from '@google/genai';

/**
 * Intelligent multilingual rule parser for Kirana & Chai shops.
 * Handles Hindi (Devanagari & Hinglish), Kannada, and English.
 * Guarantees instantaneous, bulletproof interpretation even without internet or API key.
 */
function parseWithRuleEngine(text, preferredLang = 'hi') {
  const t = text.trim();
  const lower = t.toLowerCase();

  // 1. Check for Query commands
  if (
    lower.includes('aaj kitna udhaar') ||
    lower.includes('kitna udhaar baaki') ||
    lower.includes('total udhaar') ||
    lower.includes('how much udhaar') ||
    lower.includes('pending udhaar') ||
    t.includes('ಉದ್ರಿ ಎಷ್ಟು') ||
    t.includes('ಉದ್ರಿ ಬಾಕಿ') ||
    lower.includes('udri eshtu')
  ) {
    return {
      action: 'QUERY_UDHAAR',
      confidence: 0.95,
      explanation: 'Check total outstanding udhaar balance',
      spokenFeedback: 'दुकान का कुल बकाया उधार लोड किया जा रहा है।',
      engine: 'DukaanSaathi Voice Engine (Fallback)',
    };
  }

  if (
    lower.includes('low stock') ||
    lower.includes('kam stock') ||
    lower.includes('stock alert') ||
    lower.includes('khatam') ||
    t.includes('ಕಡಿಮೆ ಸ್ಟಾಕ್') ||
    lower.includes('kadime stock')
  ) {
    return {
      action: 'QUERY_LOW_STOCK',
      confidence: 0.95,
      explanation: 'View products that are low in stock',
      spokenFeedback: 'कम स्टॉक वाले सामान की लिस्ट दिखाई जा रही है।',
      engine: 'DukaanSaathi Voice Engine (Fallback)',
    };
  }

  // 2. Numbers extraction
  // Handles ₹40, 40 rupaye, 40 rs, 40 ರೂಪಾಯಿ, etc.
  const numMatches = t.match(/\d+(\.\d+)?/g);
  const primaryNumber = numMatches ? parseFloat(numMatches[0]) : null;

  // 3. Detect Udhaar Repayment:
  // "Ramesh ne 20 rupaye wapas diye", "Ramesh ne 30 rupaye pay kiye", "Ramesh paid 40", "ರಮೇಶ್ 20 ರೂಪಾಯಿ ಕೊಟ್ಟಿದ್ದಾನೆ"
  const isRepayment =
    lower.includes('wapas') ||
    lower.includes('waapas') ||
    lower.includes('pay kiye') ||
    lower.includes('pay kiya') ||
    lower.includes('chuka') ||
    lower.includes('paid') ||
    lower.includes('returned') ||
    lower.includes('deposit') ||
    lower.includes('bhara') ||
    t.includes('ಕೊಟ್ಟಿದ್ದಾನೆ') ||
    t.includes('ಕೊಟ್ಟಿದಾರೆ') ||
    lower.includes('kottiddane') ||
    lower.includes('kottidare');

  // 4. Detect Add Udhaar:
  // "Ramesh ko 40 rupaye udhaar do", "Ramesh udhaar 50", "Add 50 udhaar to Ramesh", "ರಮೇಶ್ ಗೆ 50 ರೂಪಾಯಿ ಉದ್ರಿ ಕೊಡು"
  const isAddUdhaar =
    !isRepayment &&
    (lower.includes('udhaar') ||
      lower.includes('udhar') ||
      lower.includes('credit') ||
      lower.includes('khata') ||
      lower.includes('khaata') ||
      t.includes('ಉದ್ರಿ') ||
      lower.includes('udri'));

  if (isRepayment || isAddUdhaar) {
    // Extract customer name
    let customerName = '';
    // Match patterns like: "Ramesh ko...", "Ramesh ne...", "Add 40 to Ramesh", "ರಮೇಶ್ ಗೆ...", "ರಮೇಶ್..."
    const hinglishMatch = t.match(/([a-zA-Z\u0900-\u097F\u0C80-\u0CFF]+)\s+(ko|ne|ka|ki|ge|se)\b/i);
    if (hinglishMatch) {
      customerName = hinglishMatch[1].trim();
    } else {
      // First word if not a command keyword
      const words = t.split(/\s+/).filter((w) => !/^(add|give|record|udhaar|udhar|rupaye|rs|₹|ne|ko)$/i.test(w));
      if (words.length > 0) customerName = words[0];
    }

    // Capitalize clean name
    if (customerName) {
      customerName = customerName.charAt(0).toUpperCase() + customerName.slice(1);
    }

    if (!customerName || !primaryNumber) {
      return {
        action: 'NEED_CLARIFICATION',
        customerName: customerName || null,
        amount: primaryNumber || null,
        confidence: 0.5,
        explanation: 'Customer name or amount is unclear.',
        clarificationQuestion: 'कृपया ग्राहक का नाम और सही राशि बताएं (e.g. "Ramesh ko 40 rupaye udhaar do").',
        spokenFeedback: 'कृपया ग्राहक का नाम और राशि स्पष्ट बोलें।',
        engine: 'DukaanSaathi Voice Engine (Fallback)',
      };
    }

    if (isRepayment) {
      return {
        action: 'RECORD_REPAYMENT',
        customerName,
        amount: primaryNumber,
        confidence: 0.94,
        explanation: `Record repayment of ₹${primaryNumber} from ${customerName}`,
        spokenFeedback: `${customerName} से ₹${primaryNumber} की वापसी रिकॉर्ड की जाएगी। पुष्टि करें?`,
        engine: 'DukaanSaathi Voice Engine (Fallback)',
      };
    } else {
      return {
        action: 'ADD_UDHAAR',
        customerName,
        amount: primaryNumber,
        confidence: 0.95,
        explanation: `Add ₹${primaryNumber} udhaar to ${customerName}`,
        spokenFeedback: `${customerName} के खाते में ₹${primaryNumber} उधार दर्ज किया जाएगा। पुष्टि करें?`,
        engine: 'DukaanSaathi Voice Engine (Fallback)',
      };
    }
  }

  // 5. Detect Stock adjustments:
  // "Milk ke 5 packet stock mein add karo", "Add 10 milk packets", "ಹಾಲು 10 ಪ್ಯಾಕೆಟ್ ಸೇರಿಸಿ"
  // "Reduce sugar stock by 2 packets", "Sugar ke 2 packet kam karo", "ಸಕ್ಕರೆ 2 ಕೆಜಿ ಕಡಿಮೆ ಮಾಡಿ"
  const isStockAdd =
    lower.includes('add') ||
    lower.includes('badao') ||
    lower.includes('badhao') ||
    lower.includes('plus') ||
    lower.includes('jodo') ||
    t.includes('ಸೇರಿಸಿ') ||
    lower.includes('serisi') ||
    (lower.includes('stock mein') && !lower.includes('kam'));

  const isStockReduce =
    lower.includes('reduce') ||
    lower.includes('kam karo') ||
    lower.includes('ghatao') ||
    lower.includes('minus') ||
    lower.includes('becha') ||
    lower.includes('sold') ||
    lower.includes('nikalo') ||
    t.includes('ಕಡಿಮೆ') ||
    lower.includes('kadime');

  if (isStockAdd || isStockReduce) {
    // Extract known products
    const productKeywords = [
      { key: 'milk', name: 'Amul Milk', unit: 'packets' },
      { key: 'doodh', name: 'Amul Milk', unit: 'packets' },
      { key: 'ಹಾಲು', name: 'Amul Milk', unit: 'packets' },
      { key: 'haalu', name: 'Amul Milk', unit: 'packets' },
      { key: 'sugar', name: 'Tata Sugar', unit: 'kg' },
      { key: 'cheeni', name: 'Tata Sugar', unit: 'kg' },
      { key: 'chini', name: 'Tata Sugar', unit: 'kg' },
      { key: 'ಸಕ್ಕರೆ', name: 'Tata Sugar', unit: 'kg' },
      { key: 'sakkare', name: 'Tata Sugar', unit: 'kg' },
      { key: 'tea', name: 'Red Label Tea', unit: 'packets' },
      { key: 'chai', name: 'Red Label Tea', unit: 'packets' },
      { key: 'chaha', name: 'Red Label Tea', unit: 'packets' },
      { key: 'tea patti', name: 'Red Label Tea', unit: 'packets' },
      { key: 'oil', name: 'Fortune Mustard Oil', unit: 'litres' },
      { key: 'tel', name: 'Fortune Mustard Oil', unit: 'litres' },
      { key: 'ಎಣ್ಣೆ', name: 'Fortune Mustard Oil', unit: 'litres' },
      { key: 'enne', name: 'Fortune Mustard Oil', unit: 'litres' },
      { key: 'atta', name: 'Aashirvaad Atta', unit: 'kg' },
      { key: 'aata', name: 'Aashirvaad Atta', unit: 'kg' },
      { key: 'ಹಿಟ್ಟು', name: 'Aashirvaad Atta', unit: 'kg' },
      { key: 'hittu', name: 'Aashirvaad Atta', unit: 'kg' },
      { key: 'biscuit', name: 'Parle-G Biscuits', unit: 'packets' },
      { key: 'parle', name: 'Parle-G Biscuits', unit: 'packets' },
    ];

    let foundProduct = null;
    for (const item of productKeywords) {
      if (lower.includes(item.key) || t.includes(item.key)) {
        foundProduct = item;
        break;
      }
    }

    // Fallback: extract candidate word before "stock" or "packet"
    let productName = foundProduct ? foundProduct.name : '';
    let unit = foundProduct ? foundProduct.unit : 'packets';
    if (!productName) {
      const pMatch = t.match(/([a-zA-Z\u0900-\u097F]+)\s+(ke|ka|ki|stock|packet)/i);
      if (pMatch && !/^(add|reduce|kam|more)$/i.test(pMatch[1])) {
        productName = pMatch[1].charAt(0).toUpperCase() + pMatch[1].slice(1);
      }
    }

    if (!productName || !primaryNumber) {
      return {
        action: 'NEED_CLARIFICATION',
        productName: productName || null,
        quantity: primaryNumber || null,
        confidence: 0.5,
        explanation: 'Product name or quantity is unclear.',
        clarificationQuestion: 'कृपया सामान का नाम और मात्रा बताएं (e.g. "Milk ke 5 packet stock mein add karo").',
        spokenFeedback: 'सामान का नाम या मात्रा स्पष्ट नहीं है।',
        engine: 'DukaanSaathi Voice Engine (Fallback)',
      };
    }

    if (isStockReduce) {
      return {
        action: 'REDUCE_STOCK',
        productName,
        quantity: primaryNumber,
        unit,
        confidence: 0.94,
        explanation: `Reduce ${productName} stock by ${primaryNumber} ${unit}`,
        spokenFeedback: `${productName} के ${primaryNumber} ${unit} स्टॉक से घटाए जाएंगे। पुष्टि करें?`,
        engine: 'DukaanSaathi Voice Engine (Fallback)',
      };
    } else {
      return {
        action: 'ADD_STOCK',
        productName,
        quantity: primaryNumber,
        unit,
        confidence: 0.95,
        explanation: `Add ${primaryNumber} ${unit} to ${productName} stock`,
        spokenFeedback: `${productName} में ${primaryNumber} ${unit} स्टॉक जोड़ा जाएगा। पुष्टि करें?`,
        engine: 'DukaanSaathi Voice Engine (Fallback)',
      };
    }
  }

  return {
    action: 'UNKNOWN',
    confidence: 0.3,
    explanation: `Could not determine exact action from: "${t}"`,
    clarificationQuestion: 'आदेश समझ नहीं आया। कृपया कहें "Ramesh ko 40 rupaye udhaar do" या "Add 5 milk packets".',
    spokenFeedback: 'आदेश समझ नहीं आया। कृपया दोबारा बोलें।',
    engine: 'DukaanSaathi Voice Engine (Fallback)',
  };
}

/**
 * Main parser using Google Gemini API with fallback to offline multilingual rule engine.
 */
export async function parseShopCommand(text, language = 'hi') {
  if (!text || !text.trim()) {
    throw new Error('Command text is empty');
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey.trim() && apiKey !== 'your_api_key_here') {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are the AI assistant for an Indian Kirana/Chai shopkeeper ("DukaanSaathi AI").
Interpret the shopkeeper's voice command in Hindi, Kannada, or English and extract structured transaction intent.

User voice transcript: "${text}"

You MUST respond strictly with a valid JSON object without markdown formatting, following this exact schema:
{
  "action": "ADD_UDHAAR" | "RECORD_REPAYMENT" | "ADD_STOCK" | "REDUCE_STOCK" | "QUERY_UDHAAR" | "QUERY_LOW_STOCK" | "UNKNOWN",
  "customerName": string or null,
  "amount": number or null,
  "productName": string or null,
  "quantity": number or null,
  "unit": string or null,
  "confidence": number between 0 and 1,
  "explanation": "Short clear summary in English of what will happen",
  "spokenFeedback": "Short response in spoken Hindi, Kannada, or English asking for confirmation or stating the answer",
  "clarificationQuestion": string or null if details like customer name or amount are missing
}

Rules:
1. "Ramesh ko 40 rupaye udhaar do" -> action: "ADD_UDHAAR", customerName: "Ramesh", amount: 40
2. "Ramesh ne 20 rupaye wapas diye" or "Ramesh ne pay kiye" -> action: "RECORD_REPAYMENT", customerName: "Ramesh", amount: 20
3. "Milk ke 5 packet stock mein add karo" -> action: "ADD_STOCK", productName: "Amul Milk" (or Milk), quantity: 5, unit: "packets"
4. "Reduce sugar stock by 2 packets" -> action: "REDUCE_STOCK", productName: "Tata Sugar" (or Sugar), quantity: 2, unit: "kg" or "packets"
5. If customer name or amount is missing or ambiguous, action must be "UNKNOWN" and provide a helpful clarificationQuestion.
6. Do NOT invent unknown customers or random numbers.`;

      // Try gemini-2.5-flash or gemini-1.5-flash
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const rawText = response.text || '';
      // Clean possible markdown code fences
      const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      return {
        ...parsed,
        engine: 'Google Gemini 2.5 AI',
      };
    } catch (err) {
      console.warn('Gemini API call failed or encountered error:', err.message);
      console.log('Falling back to DukaanSaathi rule-based voice interpreter.');
      return parseWithRuleEngine(text, language);
    }
  }

  // When GEMINI_API_KEY is not configured, run rule engine
  return parseWithRuleEngine(text, language);
}
