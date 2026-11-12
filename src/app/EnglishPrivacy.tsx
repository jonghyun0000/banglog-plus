export function EnglishPrivacy() {
  return (
    <div className="prose">
      <h2>Analysis and deletion</h2>
      <p>
        You can start without an account. The live service sends your selected
        answers, masked description, relevant lease excerpt, and reported
        findings or replies to OpenAI. Response storage is disabled
        (store:false), and abuse monitoring logs may be kept for up to 30 days
        by default. Demo mode does not contact OpenAI.
      </p>
      <p>
        Live session data is stored for up to 24 hours. You can delete it while
        the session is open. Reloading the page removes access to that session.
        Public pilot counts contain no identifiers or free text and remain after
        individual records are deleted.
      </p>
      <h2>Photos and building information</h2>
      <p>
        Optional photos require separate consent. Banglog does not store
        original photos. Observations and device details may be stored with the
        result. Cover faces, names, addresses, phone numbers, serial numbers and
        QR codes before uploading.
      </p>
      <p>
        Optional building lookup uses Kakao and public building records. The
        lookup address is not kept with the analysis. Selected building
        attributes and follow-up answers may be used in analysis and stored with
        the result.
      </p>
      <h2>Saving your records</h2>
      <p>
        Guides you choose to save while signed in are kept for up to 90 days.
        The repair and move-out log and its attachments stay in this browser.
        Clearing browser data can erase them. Use the log to export or delete
        its records. Sign out on shared devices.
      </p>
      <p>
        Leave out addresses, phone numbers, IDs, bank account details and full
        lease documents. This service gives general guidance for rentals in
        Korea. Individual cases may need professional advice.
      </p>
    </div>
  );
}
