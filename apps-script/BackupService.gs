// Daily transaction backup functions

/**
 * Creates and sends a daily transaction report via email
 */
function sendDailyTransactionReport() {
  try {
    // Get today's date in a formatted string
    const today = new Date();
    const dateString = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
    
    // Get the spreadsheet where your data is stored
    const ss = SpreadsheetApp.getActiveSpreadsheet(); // Or use openById() if you know the ID
    const transactionsSheet = ss.getSheetByName("Transactions"); // Adjust to your sheet name
    
    if (!transactionsSheet) {
      Logger.log("Transactions sheet not found!");
      return "Error: Transactions sheet not found";
    }
    
    // Get all transaction data
    const data = transactionsSheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    // Find the date column index (assuming you have a column named "date" or similar)
    const dateColumnIndex = headers.findIndex(header => 
      header.toString().toLowerCase() === "date" || 
      header.toString().toLowerCase().includes("date")
    );
    
    if (dateColumnIndex === -1) {
      Logger.log("Date column not found in the sheet!");
      // If no date column, just proceed with all transactions
    }
    
    // Filter for yesterday's transactions (if date column exists)
    let todayTransactions = rows;
    if (dateColumnIndex !== -1) {
      todayTransactions = rows.filter(row => {
        if (!row[dateColumnIndex]) return false;
        
        let transactionDate;
        if (row[dateColumnIndex] instanceof Date) {
          transactionDate = row[dateColumnIndex];
        } else {
          // Try to parse the date string
          transactionDate = new Date(row[dateColumnIndex]);
        }
        
        if (isNaN(transactionDate.getTime())) return false;
        
        const txDateString = Utilities.formatDate(
          transactionDate, 
          Session.getScriptTimeZone(), 
          "yyyy-MM-dd"
        );
        
        // Get yesterday's transactions for the daily report 
        // (assuming this runs early morning)
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayString = Utilities.formatDate(
          yesterday, 
          Session.getScriptTimeZone(), 
          "yyyy-MM-dd"
        );
        
        return txDateString === yesterdayString;
      });
    }
    
    // Create CSV content for yesterday's transactions
    let todayCsvContent = headers.join(",") + "\n";
    todayTransactions.forEach(row => {
      const formattedRow = row.map(cell => {
        // Handle strings with commas by enclosing in quotes
        if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      });
      todayCsvContent += formattedRow.join(",") + "\n";
    });
    
    // Create CSV for all transactions
    let allCsvContent = headers.join(",") + "\n";
    rows.forEach(row => {
      const formattedRow = row.map(cell => {
        if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      });
      allCsvContent += formattedRow.join(",") + "\n";
    });
    
    // Get yesterday's date for the email subject
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = Utilities.formatDate(
      yesterday, 
      Session.getScriptTimeZone(), 
      "yyyy-MM-dd"
    );
    
    // Send email with attachments
    const recipient = "accounts@ayathanschool.com"; // CHANGE THIS to your email address
    const subject = "Ayathan School Fee Collection - Daily Backup " + yesterdayString;
    const body = `
      Daily Transaction Report for ${yesterdayString}
      
      Yesterday's transactions: ${todayTransactions.length}
      Total transactions to date: ${rows.length}
      
      This is an automated backup from your Fee Collection System.
      Please find attached yesterday's transactions and the complete transaction history.
    `;
    
    // Create the attachments
    const todayAttachment = Utilities.newBlob(
      todayCsvContent, 
      "text/csv", 
      `fee_transactions_${yesterdayString}.csv`
    );
    
    const allAttachment = Utilities.newBlob(
      allCsvContent, 
      "text/csv", 
      `fee_all_transactions_backup_${dateString}.csv`
    );
    
    // Send the email
    GmailApp.sendEmail(recipient, subject, body, {
      attachments: [todayAttachment, allAttachment]
    });
    
    Logger.log("Email sent successfully!");
    return "Email sent successfully!";
  } catch (error) {
    Logger.log("Error in sendDailyTransactionReport: " + error.toString());
    return "Error: " + error.toString();
  }
}

/**
 * Creates a daily trigger to run the backup function
 * You only need to run this ONCE manually to set up the schedule
 */
function createDailyTrigger() {
  try {
    // Delete any existing triggers with the same function name
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === "sendDailyTransactionReport") {
        ScriptApp.deleteTrigger(trigger);
      }
    });
    
    // Create a new trigger to run every day at 6:00 AM
    // This time is ideal for a daily backup as it's usually before the workday begins
    ScriptApp.newTrigger("sendDailyTransactionReport")
      .timeBased()
      .atHour(6)
      .nearMinute(0)
      .everyDays(1)
      .create();
    
    Logger.log("Daily trigger created successfully!");
    return "Daily trigger created successfully!";
  } catch (error) {
    Logger.log("Error in createDailyTrigger: " + error.toString());
    return "Error: " + error.toString();
  }
}

/**
 * Run this function to test the backup process immediately
 */
function testBackupNow() {
  return sendDailyTransactionReport();
}
