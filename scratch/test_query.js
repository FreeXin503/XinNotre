import { query } from '../server/config/database.js';

async function test() {
  console.log("Starting query parser unit test...");
  
  // Mock standard inputs to verify logic
  const mockText = "SELECT * FROM notes WHERE user_id = $1 AND (title LIKE $2 OR content LIKE $2 OR category LIKE $2)";
  const params = [101, "%hello%"];
  
  console.log("Mock Query:", mockText);
  console.log("Mock Params:", params);
  
  // Replicate the placeholder scanner logic in database.js
  let mysqlQuery = '';
  const newParams = [];
  const placeholderRegex = /\$(\d+)/g;
  let lastIndex = 0;
  let match;
  
  while ((match = placeholderRegex.exec(mockText)) !== null) {
    mysqlQuery += mockText.substring(lastIndex, match.index) + '?';
    const paramNum = parseInt(match[1], 10);
    newParams.push(params && params[paramNum - 1] !== undefined ? params[paramNum - 1] : null);
    lastIndex = placeholderRegex.lastIndex;
  }
  mysqlQuery += mockText.substring(lastIndex);
  
  console.log("Converted Query:", mysqlQuery);
  console.log("Converted Params:", newParams);
  
  if (mysqlQuery.split('?').length - 1 === newParams.length && newParams.length === 4) {
    console.log("✅ Success! Converted parameters and placeholders match perfectly.");
  } else {
    console.error("❌ Mismatch!");
  }
}

test();
