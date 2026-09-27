const LINK_ATTRS = 'target="_blank" rel="noopener noreferrer"';

export const STATIC_EDITORIAL_ARTICLES_PHASE_2 = [
  {
    id: "f6a109b2-static-hdmi-earc",
    title: "HDMI ARC ও eARC দিয়ে soundbar ঠিকভাবে সেটআপ করার গাইড",
    seo_title: "HDMI ARC ও eARC Soundbar Setup ও Troubleshooting Guide",
    seo_description: "TV ও soundbar-এ ARC/eARC port, HDMI-CEC, audio output এবং cable ধাপে ধাপে পরীক্ষা করে sound সমস্যা সমাধানের বাংলা গাইড।",
    content_type: "article",
    featured_image_url: "",
    published_at: "2026-08-03T22:00:00.000+06:00",
    updated_at: "2026-08-03T22:00:00.000+06:00",
    is_published: true,
    position: 13,
    content_html: `
      <section>
        <p>নতুন soundbar লাগানোর পর TV-এর শব্দ না আসা, remote দিয়ে volume না বদলানো বা বারবার input হারিয়ে যাওয়া খুব পরিচিত সমস্যা। বেশির ভাগ ক্ষেত্রে soundbar নষ্ট নয়; ভুল HDMI port, ARC/eARC setting, HDMI-CEC অথবা audio format mismatch দায়ী। Menu-এর নাম brand অনুযায়ী বদলায়, কিন্তু diagnosis-এর নিয়ম প্রায় একই।</p>
        <h2>ARC ও eARC কী কাজ করে</h2>
        <p>Audio Return Channel বা ARC একই HDMI connection দিয়ে TV থেকে soundbar বা receiver-এ audio ফেরত পাঠায়। Enhanced Audio Return Channel বা eARC বেশি bandwidth এবং উন্নত audio format support করতে পারে। সুবিধাটি পেতে TV ও sound system-এর সংশ্লিষ্ট port-এ ARC বা eARC লেখা থাকতে হবে। শুধু যেকোনো HDMI port ব্যবহার করলে picture চললেও return audio নাও আসতে পারে।</p>
        <h2>সঠিক সংযোগের checklist</h2>
        <ol>
          <li>দুই device বন্ধ করে TV-এর ARC/eARC port থেকে soundbar-এর HDMI OUT (ARC/eARC) port-এ cable দিন।</li>
          <li>TV settings-এ audio output হিসেবে external speaker, receiver বা HDMI ARC নির্বাচন করুন।</li>
          <li>TV ও soundbar—দুই জায়গায় HDMI-CEC চালু করুন। Brand ভেদে এটি Anynet+, Bravia Sync বা SimpLink-এর মতো নামে থাকতে পারে।</li>
          <li>প্রথম পরীক্ষায় digital audio format PCM দিন। কাজ করলে Auto, Pass-through বা supported surround format পরীক্ষা করুন।</li>
          <li>সব device পুরোপুরি power off করে এক মিনিট পর TV, soundbar এবং source device চালু করুন।</li>
        </ol>
        <h2>শব্দ না এলে সমস্যাটি আলাদা করুন</h2>
        <p>প্রথমে TV-এর built-in app চালান। এতে sound এলে ARC path কাজ করছে; external box বা console-এর setting পরীক্ষা করতে হবে। এরপর source device সরাসরি TV-তে লাগিয়ে audio ARC/eARC দিয়ে soundbar-এ পাঠান। Google TV-এর official troubleshooting-ও AVR বা soundbar-কে HDMI chain থেকে সাময়িক সরিয়ে direct-TV test করার পরামর্শ দেয়। এতে কোন device handshake আটকাচ্ছে বোঝা যায়।</p>
        <h2>Cable বদলানোর আগে যা দেখবেন</h2>
        <p>Connector ঢিলা কি না, cable অতিরিক্ত বাঁকানো কি না এবং port label সঠিক কি না দেখুন। eARC বা high-bandwidth format-এর জন্য device maker যে cable specification চেয়েছে সেটি অনুসরণ করুন। দামি cable মানেই সমাধান নয়। একটি পরিচিত কার্যকর, প্রয়োজনীয় specification-এর ছোট cable দিয়ে test বেশি নির্ভরযোগ্য। Firmware update-এর পরে setting reset হলে audio output ও CEC আবার যাচাই করুন।</p>
        <h2>কখন optical cable ব্যবহার করা যায়</h2>
        <p>ARC handshake স্থায়ীভাবে ব্যর্থ হলে optical একটি সহজ fallback হতে পারে। তবে TV remote control, CEC এবং কিছু advanced audio format সীমিত হতে পারে। Bluetooth দ্রুত test-এর জন্য ভালো, কিন্তু lip-sync delay হতে পারে। স্থায়ী setup বাছার আগে আপনার TV ও soundbar manual-এর supported format মিলিয়ে নিন।</p>
        <h2>সূত্র ও আরও পড়ুন</h2>
        <ul>
          <li><a href="https://support.google.com/googletv/answer/16995384?hl=en" ${LINK_ATTRS}>Google TV Help: startup ও audio issue</a> — direct connection, ARC/eARC এবং CEC পরীক্ষা।</li>
          <li><a href="https://www.hdmi.org/download/savefile?bucket=hdmi-web-public&amp;fileKey=Specifications%2F1dot4_feature_archive.pdf" ${LINK_ATTRS}>HDMI Licensing Administrator: ARC feature archive</a> — ARC port ও connection-এর technical reference।</li>
        </ul>
        <p><strong>সম্পাদকের নোট:</strong> বিদ্যুৎ সংযোগ থাকা অবস্থায় port-এ জোর প্রয়োগ করবেন না। Supported format ও update procedure-এর জন্য নিজের model-এর official manual অনুসরণ করুন।</p>
      </section>
    `,
  },
  {
    id: "07b21ac3-static-tv-storage",
    title: "Smart TV ধীর হলে storage পরিষ্কার ও update করার নিরাপদ উপায়",
    seo_title: "Smart TV Storage পরিষ্কার ও Performance ঠিক করার Guide",
    seo_description: "Smart TV slow, app crash বা storage full হলে cache, unused app, restart ও system update নিরাপদভাবে করার বাংলা checklist।",
    content_type: "article",
    featured_image_url: "",
    published_at: "2026-08-03T21:00:00.000+06:00",
    updated_at: "2026-08-03T21:00:00.000+06:00",
    is_published: true,
    position: 14,
    content_html: `
      <section>
        <p>Smart TV চালু হতে দেরি, app মাঝপথে বন্ধ বা update install না হওয়ার একটি সাধারণ কারণ হলো অল্প free storage। তবে “cleaner” app বা factory reset দিয়ে শুরু করা ঠিক নয়। আগে কম ঝুঁকির পদক্ষেপে storage ও software আলাদা করে পরীক্ষা করুন।</p>
        <h2>প্রথমে সমস্যা নথিভুক্ত করুন</h2>
        <p>সব app ধীর, নাকি একটি app? Home screen-ও lag করে কি? Settings-এর storage page-এ free space দেখুন এবং error message লিখে রাখুন। শুধু একটি service ব্যর্থ হলে internet বা service-side সমস্যা হতে পারে; সব menu ধীর হলে device storage বা system বেশি সম্ভাব্য।</p>
        <h2>নিরাপদ maintenance order</h2>
        <ol>
          <li>TV restart করুন; শুধু remote দিয়ে standby না করে documented restart option ব্যবহার করুন।</li>
          <li>App store থেকে সব প্রয়োজনীয় app update করুন।</li>
          <li>Settings থেকে system বা firmware update পরীক্ষা করুন।</li>
          <li>দীর্ঘদিন ব্যবহার না করা app uninstall করুন।</li>
          <li>সমস্যার app-এর cache clear করে আবার চালান।</li>
        </ol>
        <h2>Clear cache আর clear data এক নয়</h2>
        <p>Cache সাধারণত সাময়িক file সরায়। Clear storage বা clear data app-এর saved data, preference এবং sign-in মুছতে পারে। Android-এর official guidance-ও এই পার্থক্য স্পষ্ট করে। তাই login তথ্য জানা না থাকলে clear data চাপবেন না। Download করা programme থাকলে আগে service-এর নিয়ম দেখুন; app delete করলে download-ও হারাতে পারে।</p>
        <h2>কোন app রাখবেন</h2>
        <p>গত কয়েক মাসে ব্যবহার হয়নি, publisher অচেনা বা official store-এ আর update হয় না—এমন app review করুন। System app না বুঝে disable করবেন না। Home-screen recommendation কমানো performance সামান্য উন্নত করতে পারে, কিন্তু storage recovery-এর প্রধান উপায় হলো unused app ও download সরানো।</p>
        <h2>Factory reset শেষ ধাপ</h2>
        <p>Restart, update, cache এবং app cleanup ব্যর্থ হলে model-specific support অনুসরণ করে reset বিবেচনা করুন। তার আগে Wi-Fi password, account recovery, picture setting এবং connected device-এর তালিকা রাখুন। Reset সব account ও local setting মুছতে পারে; hardware fault বা দুর্বল internet এতে ঠিক হবে না।</p>
        <h2>সূত্র ও আরও পড়ুন</h2>
        <ul>
          <li><a href="https://support.google.com/googletv/answer/12364830?hl=en" ${LINK_ATTRS}>Google TV Help: slow বা laggy device</a> — restart, force stop, app ও system update।</li>
          <li><a href="https://support.google.com/chromecast/answer/11276506?hl=en" ${LINK_ATTRS}>Google TV storage খালি করা</a> — cache পরিষ্কার ও unused app uninstall।</li>
          <li><a href="https://support.google.com/android/answer/15728899?hl=en" ${LINK_ATTRS}>Android Help: free up space</a> — cache ও app storage-এর পার্থক্য।</li>
        </ul>
        <p><strong>সম্পাদকের নোট:</strong> Menu path brand ও software version অনুযায়ী বদলায়। Third-party cleaner বা unofficial firmware ব্যবহার করবেন না।</p>
      </section>
    `,
  },
  {
    id: "18c32bd4-static-stream-account",
    title: "Streaming account-এ অচেনা login দেখলে যা করবেন",
    seo_title: "Streaming Account-এ Unknown Login: Security Checklist",
    seo_description: "Streaming account-এ unfamiliar device বা login দেখলে password, sessions, email এবং payment নিরাপদ করার ধাপে ধাপে বাংলা গাইড।",
    content_type: "article",
    featured_image_url: "",
    published_at: "2026-08-03T20:00:00.000+06:00",
    updated_at: "2026-08-03T20:00:00.000+06:00",
    is_published: true,
    position: 15,
    content_html: `
      <section>
        <p>অচেনা profile, watch history, নতুন device বা sign-in alert দেখলে আতঙ্কে email-এর link চাপবেন না। Alert নিজেই phishing হতে পারে। পরিচিত bookmark বা service-এর official app খুলে account activity যাচাই করুন এবং নিচের order-এ কাজ করুন।</p>
        <h2>প্রথম ১৫ মিনিটের পদক্ষেপ</h2>
        <ol>
          <li>Official account page-এ recent device, session, location ও সময় দেখুন। Location IP-ভিত্তিক হলে আনুমানিক হতে পারে।</li>
          <li>অচেনা device sign out করুন; প্রয়োজন হলে sign out of all devices ব্যবহার করুন।</li>
          <li>নতুন, দীর্ঘ এবং অন্য কোথাও ব্যবহার না করা password দিন।</li>
          <li>Account email-এর password-ও বদলান যদি একই password বা compromise-এর সন্দেহ থাকে।</li>
          <li>Available হলে two-step verification, passkey বা security key চালু করুন।</li>
        </ol>
        <h2>শুধু password বদলালেই কেন শেষ নয়</h2>
        <p>Recovery email, phone, payment method, profile PIN এবং subscription plan বদলেছে কি না দেখুন। অচেনা browser extension বা unofficial streaming app credential চুরি করতে পারে; সেগুলো সরিয়ে device security scan ও update করুন। একই password অন্য site-এ থাকলে সেখানেও আলাদা password দিন।</p>
        <h2>Shared TV ও hotel device</h2>
        <p>পরিবারের device নাম সবসময় পরিষ্কার নাও হতে পারে। আগে TV model ও সর্বশেষ ব্যবহারের সময় মিলিয়ে নিন। Hotel, rental বা বন্ধুর TV-তে sign-in করলে কাজ শেষে account menu থেকে sign out করুন। শুধু app delete করলে server-side session সবসময় বন্ধ হয় না, তাই account-এর device management page-ও দেখুন।</p>
        <h2>Payment ও support নিরাপত্তা</h2>
        <p>অচেনা charge থাকলে transaction screenshot, সময় ও amount নথিভুক্ত করে service-এর official support এবং payment provider-এর সঙ্গে যোগাযোগ করুন। Search ad বা social-media comment থেকে পাওয়া support number ব্যবহার করবেন না। OTP, recovery code বা full card number কাউকে দেবেন না।</p>
        <h2>সূত্র ও আরও পড়ুন</h2>
        <ul>
          <li><a href="https://help.netflix.com/en/node/128180" ${LINK_ATTRS}>Netflix Help: manage account access and devices</a> — recent device review ও sign-out controls।</li>
          <li><a href="https://support.google.com/accounts/answer/140921?hl=en" ${LINK_ATTRS}>Google Account Help: suspicious activity</a> — password, unfamiliar device ও security review।</li>
          <li><a href="https://support.google.com/accounts/answer/10956730?hl=en" ${LINK_ATTRS}>Google: two-step verification</a> — account protection-এর অতিরিক্ত layer।</li>
        </ul>
        <p><strong>সম্পাদকের নোট:</strong> WEBTVBD কখনো email বা message-এ password বা OTP চাইবে না। প্রত্যেক service-এর current recovery flow আলাদা।</p>
      </section>
    `,
  },
  {
    id: "29d43ce5-static-picture-hdr",
    title: "TV picture quality ঠিক করবেন যেভাবে: resolution, HDR ও motion setting",
    seo_title: "TV Picture Quality: Resolution, HDR ও Motion Setting Guide",
    seo_description: "TV-তে ছবি বেশি অন্ধকার, কৃত্রিম বা ঝাপসা হলে resolution, HDR, picture mode, motion ও source quality পরীক্ষা করার বাংলা guide।",
    content_type: "article",
    featured_image_url: "",
    published_at: "2026-08-03T19:00:00.000+06:00",
    updated_at: "2026-08-03T19:00:00.000+06:00",
    is_published: true,
    position: 16,
    content_html: `
      <section>
        <p>4K TV কিনলেই প্রতিটি video 4K হয় না। Source resolution, compression, internet, HDMI output, HDR mastering এবং room light—সব মিলিয়ে final picture তৈরি হয়। তাই sharpness সর্বোচ্চ বা সব enhancement চালু করার আগে একটি neutral baseline বানান।</p>
        <h2>Source দিয়ে diagnosis শুরু করুন</h2>
        <p>একই TV-তে একটি trusted built-in app, একটি HDMI device এবং একটি পরিচিত high-quality video তুলনা করুন। শুধু একটি channel খারাপ হলে TV panel নয়, source feed বা compression দায়ী হতে পারে। সব source ফ্যাকাসে হলে picture mode, HDMI range বা panel setting দেখুন।</p>
        <h2>একটি নিরাপদ baseline</h2>
        <ul>
          <li>Movie, Cinema বা Filmmaker-এর মতো neutral mode দিয়ে শুরু করুন।</li>
          <li>Sharpness ও noise reduction মাঝারি বা কম রেখে text ও মুখ দেখুন।</li>
          <li>Overscan বন্ধ করে Full, Just Scan বা Screen Fit option পরীক্ষা করুন।</li>
          <li>Room অনুযায়ী backlight বা panel brightness বদলান; black level এলোমেলোভাবে নয়।</li>
          <li>একবারে একটি setting বদলে before/after note করুন।</li>
        </ul>
        <h2>HDR অন্ধকার মনে হলে</h2>
        <p>HDR content ও SDR content একই setting ব্যবহার নাও করতে পারে। TV সত্যিই HDR signal পেয়েছে কি না info panel-এ দেখুন। Source device-এর output format, correct HDMI port এবং enhanced HDMI mode model manual অনুযায়ী মিলান। Daylight room-এ glare কমান। Dynamic contrast বাড়ালে highlight উজ্জ্বল হলেও shadow detail হারাতে পারে।</p>
        <h2>Motion smoothing কখন কমাবেন</h2>
        <p>Motion interpolation sports-এ চলমান বল বা camera pan মসৃণ করতে পারে, কিন্তু film-এ কৃত্রিম “soap opera” look এবং artifact তৈরি করতে পারে। Movie-র জন্য off বা low, sports-এর জন্য low/medium দিয়ে test করুন। Judder, blur reduction এবং frame interpolation আলাদা control হলে একসঙ্গে সর্বোচ্চ করবেন না।</p>
        <h2>Frame rate ও dynamic range matching</h2>
        <p>Supported player original content-এর frame rate ও dynamic range match করলে অপ্রয়োজনীয় conversion কমতে পারে। Apple TV-এর official Match Content setting এর উদাহরণ। Format বদলানোর সময় কয়েক সেকেন্ড blank screen হতে পারে। অন্য platform-এ একই feature ভিন্ন নামে থাকে এবং TV support প্রয়োজন।</p>
        <h2>সূত্র ও আরও পড়ুন</h2>
        <ul>
          <li><a href="https://support.apple.com/en-au/102277" ${LINK_ATTRS}>Apple Support: Match Dynamic Range ও Frame Rate</a> — original format matching-এর official explanation।</li>
          <li><a href="https://support.apple.com/guide/tv/calibrate-video-and-audio-atvb228b7711/tvos" ${LINK_ATTRS}>Apple TV calibration tools</a> — color, overscan ও display calibration reference।</li>
        </ul>
        <p><strong>সম্পাদকের নোট:</strong> চোখে আরাম ও room condition ব্যক্তিভেদে আলাদা। Professional calibration ছাড়া copied numeric setting সব panel-এ সঠিক হয় না।</p>
      </section>
    `,
  },
  {
    id: "3ae54df6-static-live-sports",
    title: "Live sports streaming-এর আগে ১৫ মিনিটের setup checklist",
    seo_title: "Live Sports Streaming Setup Checklist",
    seo_description: "Live match শুরুর আগে legal source, internet, device, latency, power ও backup প্রস্তুত রাখার ব্যবহারিক বাংলা checklist।",
    content_type: "article",
    featured_image_url: "",
    published_at: "2026-08-03T18:00:00.000+06:00",
    updated_at: "2026-08-03T18:00:00.000+06:00",
    is_published: true,
    position: 17,
    content_html: `
      <section>
        <p>গুরুত্বপূর্ণ match শুরু হওয়ার পরে login, update বা buffering ঠিক করতে গেলে প্রথম কয়েক মিনিট হারাতে পারেন। খেলার ১৫ মিনিট আগে ছোট একটি rehearsal করলে source, network ও screen—তিন জায়গার সমস্যা আলাদা করা যায়।</p>
        <h2>১৫ মিনিট আগে</h2>
        <ol>
          <li>Broadcaster বা rights holder-এর official app/site এবং আপনার subscription access নিশ্চিত করুন।</li>
          <li>App খুলে অন্য একটি live বা replay video অন্তত দুই মিনিট চালান।</li>
          <li>TV, router ও streaming device power-এ রাখুন; laptop/phone charge দেখুন।</li>
          <li>Background download, cloud backup ও game update pause করুন।</li>
          <li>Caption, commentary language, quality এবং casting আগেই test করুন।</li>
        </ol>
        <h2>Wi-Fi নাকি Ethernet</h2>
        <p>TV ও router-এর মধ্যে supported Ethernet থাকলে crowded Wi-Fi-এর পরিবর্তন কমাতে পারে। Wi-Fi ব্যবহার করলে router-এর কাছে test করুন এবং একই network-এ বড় download বন্ধ রাখুন। Speed test ভালো হলেও live stream network congestion বা source-side delay-এ থামতে পারে। আমাদের <a href="/articles/স্মুথ-ভিডিও-স্ট্রিমিংয়ের-জন্য-wi-fi-ও-ইন্টারনেট-ঠিক-করার-গাইড-a17c9401">Wi-Fi guide</a>-এর controlled test অনুসরণ করুন।</p>
        <h2>Latency আর buffering-এর trade-off</h2>
        <p>কম delay মানে player-এর কাছে আগাম buffer কম থাকতে পারে। YouTube-এর official guidance অনুযায়ী lower latency interaction দ্রুত করে, কিন্তু buffering-এর ঝুঁকি বাড়াতে পারে। Viewer হিসেবে app-এ Default এবং Decrease delay option থাকলে spoiler এড়ানো বনাম stable playback—কোনটি গুরুত্বপূর্ণ তা বেছে নিন।</p>
        <h2>বৈধ backup plan</h2>
        <p>একটি দ্বিতীয় supported device ও official source login ready রাখুন। Mobile data backup হলে data allowance ও hotspot battery মাথায় রাখুন। Social media-র অচেনা “free live” link malware, phishing বা rights-violating feed হতে পারে; match-এর উত্তেজনায় app sideload বা card detail দেবেন না।</p>
        <h2>Match চলাকালে সমস্যা হলে</h2>
        <p>প্রথমে quality এক ধাপ কমান, app restart করুন এবং অন্য official device-এ পরীক্ষা করুন। শুধু একটি feed ব্যর্থ হলে broadcaster status দেখুন। সব service ব্যর্থ হলে network পরীক্ষা করুন। বারবার setting বদলে evidence নষ্ট না করে সময় ও error লিখে রাখুন।</p>
        <h2>সূত্র ও আরও পড়ুন</h2>
        <ul>
          <li><a href="https://support.google.com/youtube/answer/10232409?hl=en" ${LINK_ATTRS}>YouTube Help: streaming ও video troubleshooting</a> — playback এবং broadcast-delay guidance।</li>
          <li><a href="https://support.google.com/youtube/answer/7444635?hl=en" ${LINK_ATTRS}>YouTube Help: live-stream latency</a> — latency, buffer ও quality trade-off।</li>
        </ul>
        <p><strong>সম্পাদকের নোট:</strong> WEBTVBD unauthorized stream host বা recommend করে না। Event availability rights, region ও subscription অনুযায়ী বদলায়।</p>
      </section>
    `,
  },
  {
    id: "4bf65ea7-static-offline-download",
    title: "ফোনে video offline download: storage, expiry ও privacy guide",
    seo_title: "ফোনে Video Offline Download করার নিরাপদ Guide",
    seo_description: "Official app-এ video download করার আগে storage, quality, expiry, Wi-Fi, SD card ও shared-device privacy বোঝার বাংলা guide।",
    content_type: "article",
    featured_image_url: "",
    published_at: "2026-08-03T17:00:00.000+06:00",
    updated_at: "2026-08-03T17:00:00.000+06:00",
    is_published: true,
    position: 18,
    content_html: `
      <section>
        <p>যাত্রা, load shedding বা সীমিত mobile data-তে official offline download সুবিধাজনক। কিন্তু “download” মানেই gallery-তে স্থায়ী video file নয়। অনেক service content encrypt করে app-এর ভেতরে রাখে, নির্দিষ্ট সময় পর internet-এ reconnect চায় এবং rights বদলালে video সরাতে পারে।</p>
        <h2>Download-এর আগে পাঁচটি প্রশ্ন</h2>
        <ul>
          <li>এই title, region ও account plan-এ offline viewing available কি?</li>
          <li>কত storage খালি আছে এবং app কোন quality বেছে নিয়েছে?</li>
          <li>Download Wi-Fi only কি না?</li>
          <li>কত দিন বা ঘণ্টা পরে reconnect/expiry হবে?</li>
          <li>Device হারালে app lock ও screen lock data রক্ষা করবে কি?</li>
        </ul>
        <h2>Quality বনাম storage</h2>
        <p>Higher quality বেশি জায়গা ও data নেয়। Phone screen-এ long trip-এর জন্য standard quality অনেক সময় যথেষ্ট। প্রথমে একটি episode download করে file size ও picture দেখুন, তারপর পুরো series নিন। Device storage খুব কম রাখলে system ও অন্য app অস্থির হতে পারে। YouTube Help জানায়, available storage ৫ শতাংশের নিচে গেলে নতুন download বন্ধ হতে পারে; অন্য service-এর সীমা আলাদা।</p>
        <h2>SD card ব্যবহারের নিয়ম</h2>
        <p>App support করলে download location হিসেবে SD card নির্বাচন করা যায়। YouTube-এর ক্ষেত্রে আগে download করা video সরাসরি move হয় না; location বদলাতে delete করে আবার download করতে হতে পারে। Card খুলে নেওয়া, corrupt হওয়া বা app reinstall করলে offline item হারাতে পারে। জরুরি file-এর একমাত্র copy হিসেবে streaming download রাখবেন না।</p>
        <h2>Expiry ও travel preparation</h2>
        <p>যাত্রার আগের রাতে app online খুলে download playable কি না test করুন। YouTube-এর available-region guidance অনুযায়ী কিছু offline content ৪৮ ঘণ্টা এবং কিছু ক্ষেত্রে ২৯ দিন পর্যন্ত reconnect ছাড়া চলতে পারে; title, region ও membership অনুযায়ী নিয়ম বদলায়। তাই সব service-এ একই সময় ধরে নেবেন না।</p>
        <h2>Privacy ও legal boundary</h2>
        <p>Shared phone-এ profile lock ও device screen lock দিন। Official app-এর encrypted content extract, re-upload বা screen-record করে বিতরণ করবেন না। Public Wi-Fi-তে login করলে fake captive portal এড়িয়ে official app ব্যবহার করুন। কাজ শেষে অচেনা device ও active session review করুন।</p>
        <h2>সূত্র ও আরও পড়ুন</h2>
        <ul>
          <li><a href="https://support.google.com/youtube/answer/6141269?hl=en" ${LINK_ATTRS}>YouTube Help: offline video FAQ</a> — availability, reconnect, quality ও storage guidance।</li>
          <li><a href="https://support.google.com/youtube/answer/7381355?hl=en" ${LINK_ATTRS}>YouTube Help: SD card download</a> — download location ও re-download rule।</li>
        </ul>
        <p><strong>সম্পাদকের নোট:</strong> Download feature, expiry ও device limit service এবং licensing অনুযায়ী পরিবর্তিত হয়। App-এর current terms দেখুন।</p>
      </section>
    `,
  },
  {
    id: "5c076fb8-static-subscription",
    title: "Streaming subscription, free trial ও auto-renewal নিয়ন্ত্রণের গাইড",
    seo_title: "Streaming Subscription ও Auto-Renewal Management Guide",
    seo_description: "Free trial, renewal date, cancellation proof, family plan ও monthly streaming budget গুছিয়ে রাখার ব্যবহারিক বাংলা guide।",
    content_type: "article",
    featured_image_url: "",
    published_at: "2026-08-03T16:00:00.000+06:00",
    updated_at: "2026-08-03T16:00:00.000+06:00",
    is_published: true,
    position: 19,
    content_html: `
      <section>
        <p>কম দামের কয়েকটি streaming plan আলাদা আলাদা নিলে মোট খরচ চোখ এড়িয়ে যায়। Free trial শেষ হওয়ার তারিখ, app store billing এবং direct website billing এক জায়গায় না থাকলে cancellation-ও জটিল হয়। একটি ছোট subscription register এই সমস্যা কমায়।</p>
        <h2>এক পাতার register বানান</h2>
        <p>Service, plan, মাসিক/বার্ষিক মূল্য, billing channel, next renewal, payment method, cancellation path এবং পরিবারের ব্যবহারকারী লিখুন। Bank statement ও app-store subscription page মিলিয়ে অচেনা বা duplicate charge খুঁজুন। Password spreadsheet-এ রাখবেন না; password manager ব্যবহার করুন।</p>
        <h2>Free trial নেওয়ার আগে</h2>
        <ul>
          <li>Trial কত দিনের এবং কখন paid plan শুরু হবে পড়ুন।</li>
          <li>Cancellation সঙ্গে সঙ্গে access বন্ধ করে, নাকি period শেষ পর্যন্ত চলে—জানুন।</li>
          <li>Renewal price, tax এবং কোন plan auto-selected তা দেখুন।</li>
          <li>Renewal-এর দুই দিন আগে calendar reminder দিন।</li>
          <li>Pre-checked add-on বা bundle untick হয়েছে কি না দেখুন।</li>
        </ul>
        <h2>Cancel করার সঠিক জায়গা</h2>
        <p>Website-এ subscribe করলে website account, Apple/Google app store-এ নিলে সংশ্লিষ্ট subscription settings, আর operator bundle হলে operator portal-এ cancel করতে হতে পারে। App uninstall সাধারণত subscription cancel করে না। Final confirmation screen, email এবং effective date সংরক্ষণ করুন।</p>
        <h2>মাসিক review rule</h2>
        <p>প্রতি মাসে কোন service সত্যি ব্যবহার হয়েছে দেখুন। একসঙ্গে সব রাখার বদলে content season অনুযায়ী rotate করা যেতে পারে, যদি cancellation ও reactivation terms সুবিধাজনক হয়। Family plan কেবল terms-এ অনুমোদিত household-এর মধ্যে ভাগ করুন। অচেনা reseller বা “lifetime account” offer এড়িয়ে চলুন।</p>
        <h2>Charge চলতে থাকলে</h2>
        <p>Cancellation proof, receipt ও statement নিয়ে service-এর official billing support-এ যোগাযোগ করুন। Social media reply-তে card বা OTP দেবেন না। FTC-এর consumer guidance অনুযায়ী statement নিয়মিত দেখা এবং company সমস্যা সমাধান না করলে card issuer-এর dispute option সময়মতো দেখা গুরুত্বপূর্ণ; স্থানীয় payment rule আলাদা হতে পারে।</p>
        <h2>সূত্র ও আরও পড়ুন</h2>
        <ul>
          <li><a href="https://consumer.ftc.gov/articles/getting-and-out-free-trials-auto-renewals-and-negative-option-subscriptions" ${LINK_ATTRS}>FTC Consumer Advice: free trial ও auto-renewal</a> — terms, reminders, cancellation ও statement review।</li>
        </ul>
        <p><strong>সম্পাদকের নোট:</strong> এটি budgeting guidance, legal বা financial advice নয়। Refund ও cancellation rights দেশ, service ও payment channel অনুযায়ী আলাদা।</p>
      </section>
    `,
  },
  {
    id: "6d1870c9-static-audio-sync",
    title: "TV-তে ঠোঁট ও শব্দ না মিললে এবং dialogue অস্পষ্ট হলে সমাধান",
    seo_title: "TV Audio Sync ও Dialogue Clarity Troubleshooting Guide",
    seo_description: "TV, soundbar ও streaming app-এ lip-sync delay, echo বা অস্পষ্ট dialogue ধাপে ধাপে পরীক্ষা করার বাংলা troubleshooting guide।",
    content_type: "article",
    featured_image_url: "",
    published_at: "2026-08-03T15:00:00.000+06:00",
    updated_at: "2026-08-03T15:00:00.000+06:00",
    is_published: true,
    position: 20,
    content_html: `
      <section>
        <p>মুখ নড়ার পরে শব্দ আসা, TV ও soundbar একসঙ্গে বাজিয়ে echo হওয়া বা action scene-এ dialogue হারিয়ে যাওয়া—তিনটি আলাদা সমস্যা। একসঙ্গে সব setting বদলালে কারণ বোঝা কঠিন হয়। একটি পরিচিত scene দিয়ে প্রতিটি audio path আলাদা করে test করুন।</p>
        <h2>সমস্যা কোথায় তা আলাদা করুন</h2>
        <ol>
          <li>TV speaker একা চালান। Sync ঠিক থাকলে external audio path দেখুন।</li>
          <li>একই clip built-in app ও HDMI source-এ চালান।</li>
          <li>Soundbar wired connection-এ test করুন; Bluetooth সাময়িক বন্ধ রাখুন।</li>
          <li>TV এবং soundbar একসঙ্গে বাজছে কি না শুনুন; echo হলে একটি output বন্ধ করুন।</li>
          <li>অন্য official app দিয়ে পরীক্ষা করে নির্দিষ্ট content-এর mix সমস্যা কি না দেখুন।</li>
        </ol>
        <h2>Lip-sync adjustment</h2>
        <p>TV, soundbar বা receiver-এ Audio Delay, AV Sync বা Lip Sync setting থাকতে পারে। Delay কোন দিকে কাজ করে manual দেখে ছোট ধাপে বদলান। যদি sound আগে আসে, audio delay সাহায্য করতে পারে; sound ইতিমধ্যে পরে এলে আরও delay দেবেন না। Picture processing কমাতে Game mode test করা যায়, কিন্তু permanent movie setting হিসেবে রাখার আগে quality তুলনা করুন।</p>
        <h2>Dialogue পরিষ্কার করার উপায়</h2>
        <p>Sound mode হিসেবে Standard, Speech, Voice বা Dialogue Enhance available হলে তুলনা করুন। Surround effect ও bass অতিরিক্ত হলে কথা ঢাকা পড়তে পারে। Multi-channel system-এ center speaker level ও placement manual অনুযায়ী দেখুন। Volume বাড়ানোর বদলে caption ব্যবহার hearing comfort ও বোঝাপড়ায় সাহায্য করতে পারে।</p>
        <h2>Wireless speaker ও calibration</h2>
        <p>Wireless speaker-এ processing delay আলাদা হতে পারে। Apple TV 4K-এর Wireless Audio Sync tool iPhone দিয়ে wired speaker-এর latency মেপে wireless output match করতে পারে। অন্য platform-এ model-specific calibration ব্যবহার করুন। Unsupported workaround বা random delay value কপি করবেন না।</p>
        <h2>কখন hardware পরীক্ষা দরকার</h2>
        <p>সব source-এ crackle, channel হারানো বা cable নড়ালে শব্দ বদলালে connector/cable test করুন। ARC/eARC setup হলে আমাদের <a href="/articles/hdmi-arc-ও-earc-দিয়ে-soundbar-ঠিকভাবে-সেটআপ-করার-গাইড-63450a2d">HDMI ARC/eARC guide</a> অনুসরণ করুন। Firmware update এবং direct-TV connection-এর পরও সমস্যা থাকলে manufacturer support-এ model, connection diagram ও test result দিন।</p>
        <h2>সূত্র ও আরও পড়ুন</h2>
        <ul>
          <li><a href="https://support.apple.com/guide/tv/calibrate-video-and-audio-atvb228b7711/tvos" ${LINK_ATTRS}>Apple TV User Guide: video ও audio calibration</a> — Wireless Audio Sync ও calibration steps।</li>
          <li><a href="https://support.google.com/googletv/answer/16995384?hl=en" ${LINK_ATTRS}>Google TV Help: connected audio troubleshooting</a> — direct-TV, ARC/eARC ও CEC test।</li>
        </ul>
        <p><strong>সম্পাদকের নোট:</strong> খুব বেশি volume hearing ক্ষতি করতে পারে। স্থায়ী hearing বা speech-understanding সমস্যায় qualified professional-এর পরামর্শ নিন।</p>
      </section>
    `,
  },
  {
    id: "7e2981da-static-guest-wifi",
    title: "অতিথির জন্য Guest Wi-Fi ও নিরাপদ TV casting setup",
    seo_title: "Guest Wi-Fi ও Safe TV Casting Setup Guide",
    seo_description: "Guest network, আলাদা password, selected shared device ও casting privacy দিয়ে visitor access নিরাপদ রাখার বাংলা guide।",
    content_type: "article",
    featured_image_url: "",
    published_at: "2026-08-03T14:00:00.000+06:00",
    updated_at: "2026-08-03T14:00:00.000+06:00",
    is_published: true,
    position: 21,
    content_html: `
      <section>
        <p>অতিথিকে main Wi-Fi password দিলে একই network-এর printer, storage, camera বা smart-home device অনিচ্ছায় দৃশ্যমান হতে পারে। Guest network আলাদা internet access দেয় এবং supported router-এ কোন shared device দেখা যাবে তা বেছে নেওয়া যায়। তবে guest casting দরকার হলে isolation ও discovery-এর ভারসাম্য ঠিক করতে হবে।</p>
        <h2>Guest network setup</h2>
        <ol>
          <li>Router-এর official app বা local admin page খুলুন; message-এর link ব্যবহার করবেন না।</li>
          <li>Guest network চালু করে main network থেকে আলাদা নাম ও password দিন।</li>
          <li>Guest-to-LAN access defaultভাবে বন্ধ রাখুন।</li>
          <li>Router support করলে শুধু living-room TV বা streaming device share করুন।</li>
          <li>Visit শেষে temporary password বদলান বা network বন্ধ করুন।</li>
        </ol>
        <h2>Casting কেন কখনো device খুঁজে পায় না</h2>
        <p>Cast sender ও receiver সাধারণত local discovery ব্যবহার করে। কঠোর guest isolation থাকলে guest phone main network-এর TV দেখতে পাবে না। নিরাপত্তা পুরোপুরি বন্ধ না করে router-এর selected shared-device feature ব্যবহার করুন। তা না থাকলে TV ও guest phone সাময়িক একই guest network-এ রাখা বা HDMI cable ব্যবহার করা সহজ fallback।</p>
        <h2>TV-তে account sign-in এড়িয়ে চলুন</h2>
        <p>অতিথি নিজের phone-এর supported Cast/AirPlay session ব্যবহার করলে আপনার TV-তে স্থায়ী password লেখার প্রয়োজন কমে। Screen mirroring-এর আগে notification preview বন্ধ করুন এবং banking, gallery বা private chat বন্ধ রাখুন। শেষ হলে sender ও TV—দুই জায়গা থেকে session বন্ধ হয়েছে দেখুন।</p>
        <h2>Shared home-এর নিয়ম</h2>
        <p>TV ও speaker-এর সহজ নাম দিন, যাতে ভুল room-এ cast না হয়। Pairing request screen-এ দেখা code দিয়েই অনুমোদন করুন। অচেনা request reject করুন। Router firmware update, connected-device list review এবং পুরোনো guest password বদলানো মাসিক maintenance-এর অংশ করুন।</p>
        <h2>সূত্র ও আরও পড়ুন</h2>
        <ul>
          <li><a href="https://support.google.com/googlehome/answer/6327302?hl=en" ${LINK_ATTRS}>Google Home Help: Guest Wi-Fi</a> — আলাদা network, password ও selected shared device setup।</li>
          <li><a href="https://support.google.com/googlecast/answer/3006709?hl=en" ${LINK_ATTRS}>Google Cast Help: cast-enabled apps</a> — same-network ও supported-device requirements।</li>
        </ul>
        <p><strong>সম্পাদকের নোট:</strong> সব router selected-device sharing support করে না। নিজের router manufacturer-এর বর্তমান security documentation অনুসরণ করুন।</p>
      </section>
    `,
  },
  {
    id: "8f3a92eb-static-phishing",
    title: "Fake streaming app ও subscription phishing চেনার উপায়",
    seo_title: "Fake Streaming App ও Subscription Phishing Safety Guide",
    seo_description: "Free live link, fake renewal notice, unofficial APK ও support scam থেকে password, payment এবং device নিরাপদ রাখার বাংলা guide।",
    content_type: "article",
    featured_image_url: "",
    published_at: "2026-08-03T13:00:00.000+06:00",
    updated_at: "2026-08-03T13:00:00.000+06:00",
    is_published: true,
    position: 22,
    content_html: `
      <section>
        <p>“আজই account বন্ধ হবে”, “free premium”, “match দেখতে APK install করুন” বা “payment failed—এখনই update করুন”—এই urgency streaming ব্যবহারকারীকে ভুল link-এ নিতে পারে। Logo ও পরিচিত brand name থাকলেও message সত্য প্রমাণ হয় না।</p>
        <h2>সন্দেহের লক্ষণ</h2>
        <ul>
          <li>অস্বাভাবিক domain, spelling change বা shortened link।</li>
          <li>Password, OTP, recovery code বা full card detail চাওয়া।</li>
          <li>Official store বাদ দিয়ে APK, browser extension বা remote-control app install করানো।</li>
          <li>অবাস্তব lifetime plan, guaranteed free sports বা gift-এর চাপ।</li>
          <li>Search result বা social comment-এ “support” সেজে private message করা।</li>
        </ul>
        <h2>Message যাচাইয়ের নিরাপদ পদ্ধতি</h2>
        <p>Message-এর button না চেপে নিজের bookmark, typed official domain বা installed app খুলুন। Account billing page-এ একই warning আছে কি না দেখুন। Sender address পুরোটা পড়ুন, কিন্তু address ঠিক দেখালেও নিশ্চিন্ত হবেন না। Company-কে যোগাযোগ করতে official app/site-এর support link ব্যবহার করুন।</p>
        <h2>App install করার আগে</h2>
        <p>Publisher name, update history, permission এবং official website-এর store link মিলান। Video app যদি contacts, SMS, accessibility control বা device administrator access চায়, কেন দরকার তা না বুঝলে install বন্ধ করুন। Pirated feed দেখানো app privacy ও copyright—দুই ঝুঁকিই তৈরি করে। Security warning bypass বা Play Protect বন্ধ করবেন না।</p>
        <h2>ভুল করে click বা login করলে</h2>
        <ol>
          <li>Site বন্ধ করে official service-এ password বদলান।</li>
          <li>একই password ব্যবহৃত অন্য account-ও আলাদা করুন।</li>
          <li>সব session/device review করে অচেনা access sign out করুন।</li>
          <li>Two-step verification চালু করুন এবং recovery তথ্য দেখুন।</li>
          <li>App/file install হলে security software update করে scan করুন; payment দিলে provider-কে দ্রুত জানান।</li>
        </ol>
        <h2>পরিবারের জন্য সহজ নিয়ম</h2>
        <p>TV screen-এ QR code দেখালেই scan নয়—কোন app দেখাচ্ছে আগে দেখুন। OTP কাউকে নয়, support agent-কেও নয়। Paid event-এর আগে official source bookmark করে রাখুন, যাতে শেষ মুহূর্তে fake search ad-এ না যেতে হয়।</p>
        <h2>সূত্র ও আরও পড়ুন</h2>
        <ul>
          <li><a href="https://consumer.ftc.gov/articles/how-recognize-and-avoid-phishing-scams" ${LINK_ATTRS}>FTC Consumer Advice: phishing চিনুন ও এড়িয়ে চলুন</a> — suspicious link, MFA ও incident response।</li>
          <li><a href="https://support.google.com/accounts/answer/6063333?hl=en" ${LINK_ATTRS}>Google Account Help: suspicious sign-in email</a> — official account activity দিয়ে alert যাচাই।</li>
        </ul>
        <p><strong>সম্পাদকের নোট:</strong> WEBTVBD unofficial APK, pirated feed বা message-ভিত্তিক payment support দেয় না। সন্দেহ হলে link না খুলে official route ব্যবহার করুন।</p>
      </section>
    `,
  },
];
