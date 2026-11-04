// Meta Pixel for meetxport.com: page views, enquiries (Lead) and phone/email/WhatsApp clicks (Contact).
// Website enquiries are also sent server-side by api/lead.js (Conversions API) with the same event id,
// so Meta counts each one once even when a browser blocks the pixel.
(function(){
  var PIXEL_ID = '1670229504613904';

  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
  document,'script','https://connect.facebook.net/en_US/fbevents.js');

  fbq('init', PIXEL_ID);
  fbq('track', 'PageView');
  if(/services/.test(location.pathname)) fbq('track', 'ViewContent', { content_name:'Services' });

  document.addEventListener('click', function(e){
    var link = e.target.closest && e.target.closest('a[href]');
    if(!link) return;
    var href = link.getAttribute('href') || '';
    var kind = /^tel:/.test(href) ? 'phone' : /^mailto:/.test(href) ? 'email' : /wa\.me|whatsapp\.com/.test(href) ? 'whatsapp' : null;
    if(kind) fbq('track', 'Contact', { content_name:kind });
  });

  // Called by script.js after an enquiry is sent. Meta hashes the email/phone in the browser.
  window.mxTrackLead = function(details, eventId){
    var match = {};
    if(details.email) match.em = String(details.email).trim().toLowerCase();
    if(details.phone) match.ph = String(details.phone).replace(/\D/g, '');
    if(match.em || match.ph) fbq('init', PIXEL_ID, match);
    fbq('track', 'Lead', { content_name:details.source || 'website' }, { eventID:eventId });
  };
})();
