const LINK_ATTRS = 'target="_blank" rel="noopener noreferrer"';

const PUBLISHED_ON = "2026-08-03T12:00:00.000+06:00";

export const STATIC_EDITORIAL_ARTICLES = [
  {
    id: "a17c9401-static-wifi-streaming",
    title: "স্মুথ ভিডিও স্ট্রিমিংয়ের জন্য Wi-Fi ও ইন্টারনেট ঠিক করার গাইড",
    seo_title: "স্ট্রিমিংয়ের জন্য Wi-Fi ও ইন্টারনেট ঠিক করার গাইড",
    seo_description: "ভিডিও buffering কমাতে internet speed, Wi-Fi signal, router placement ও device load ধাপে ধাপে পরীক্ষা করার ব্যবহারিক গাইড।",
    content_type: "article",
    featured_image_url: "/editorial/wifi-speed-streaming.webp",
    published_at: PUBLISHED_ON,
    updated_at: PUBLISHED_ON,
    is_published: true,
    position: 8,
    content_html: `
      <section>
        <p>লাইভ টিভি বা অনলাইন ভিডিও থেমে থেমে চললে শুধু internet package-কে দায়ী করা ঠিক নয়। আপনার connection-এর advertised speed ভালো হলেও দুর্বল Wi-Fi signal, একই network-এ অনেক device, দূরে রাখা router, পুরোনো app কিংবা source-side সমস্যা buffering তৈরি করতে পারে। তাই নতুন package কেনার আগে সমস্যাটি কোথায় হচ্ছে তা ধাপে ধাপে আলাদা করা দরকার।</p>
        <h2>Speed, stability ও latency—তিনটি আলাদা বিষয়</h2>
        <p>Download speed বলে প্রতি সেকেন্ডে কত data আসতে পারে। Stability বলে সেই গতি কতটা ধারাবাহিক। Latency হলো request পাঠিয়ে response আসার বিলম্ব। Video streaming-এ পর্যাপ্ত sustained speed ও stability সবচেয়ে জরুরি। YouTube-এর official troubleshooting guide 4K-এর জন্য প্রায় 20 Mbps, 1080p-এর জন্য 5 Mbps, 720p-এর জন্য 2.5 Mbps এবং 480p-এর জন্য 1.1 Mbps sustained speed-এর guidance দেয়। এগুলো YouTube-এর recommendation—প্রতিটি service বা বাড়ির জন্য নিশ্চয়তা নয়।</p>
        <h2>প্রথমে একটি নিয়ন্ত্রিত পরীক্ষা করুন</h2>
        <ol>
          <li>অন্য device-এর download, cloud backup এবং video playback সাময়িকভাবে pause করুন।</li>
          <li>সমস্যার device-টি router-এর কাছে এনে একই video আবার চালান।</li>
          <li>Auto quality-এর বদলে 480p বা 720p নির্বাচন করে অন্তত পাঁচ মিনিট দেখুন।</li>
          <li>একই সময় অন্য একটি official video source চালিয়ে তুলনা করুন।</li>
          <li>সম্ভব হলে Wi-Fi এবং Ethernet বা mobile data-তে আলাদা করে পরীক্ষা করুন।</li>
        </ol>
        <p>Router-এর কাছে বা কম quality-তে সমস্যা চলে গেলে local network বা available bandwidth সম্ভাব্য কারণ। শুধু একটি channel বা একটি service ব্যর্থ হলে source-side সমস্যা বেশি সম্ভাব্য। সব app-এ শুধু একটি device ব্যর্থ হলে device, browser বা app update পরীক্ষা করুন।</p>
        <h2>Router placement কেন গুরুত্বপূর্ণ</h2>
        <p>Router খোলা ও কেন্দ্রীয় স্থানে রাখুন। মেঝে, বন্ধ cabinet, বড় ধাতব বস্তু, microwave এবং পুরু দেয়ালের পাশে signal দুর্বল হতে পারে। একাধিক তলা বা দীর্ঘ বাড়িতে একটি router যথেষ্ট না হলে supported mesh বা access point প্রয়োজন হতে পারে। তবে repeater যোগ করলেই সবসময় speed বাড়ে না; ভুল placement-এ একই দুর্বল signal শুধু আবার broadcast হয়।</p>
        <p>2.4 GHz band সাধারণত দূরে ভালো পৌঁছায় কিন্তু ভিড় বেশি হতে পারে। 5 GHz সাধারণত কাছাকাছি দ্রুত হলেও দেয়াল পার হলে signal দ্রুত কমে। আপনার router ও device support করলে দুই band-এ একই জায়গা থেকে পরীক্ষা করুন। Channel বা advanced setting না বুঝে এলোমেলো পরিবর্তনের আগে router manufacturer-এর documentation দেখুন।</p>
        <h2>একাধিক device-এর প্রভাব বুঝুন</h2>
        <p>একটি connection পরিবারের সবাই ভাগ করে। TV-তে live match চলার সময় laptop backup, game download এবং কয়েকটি phone video চালালে প্রত্যেকের available bandwidth কমে যায়। Speed test-এর সময় অন্য activity বন্ধ রাখলে connection-এর baseline বোঝা যায়; স্বাভাবিক ব্যবহারের সময় test করলে household load বোঝা যায়। দুই ফলের পার্থক্যই useful evidence।</p>
        <h2>Device ও app পরিষ্কারভাবে পরীক্ষা করুন</h2>
        <p>App, browser, TV firmware এবং operating system supported version-এ রাখুন। তারপর app restart, device reboot এবং প্রয়োজন হলে router-এর documented restart procedure অনুসরণ করুন। Browser extension বা VPN stream বদলে দিতে পারে; অস্থায়ীভাবে একটি clean browser profile-এ official source পরীক্ষা করা যায়। কিন্তু password, proxy বা অচেনা “speed booster” app ইনস্টল করবেন না।</p>
        <h2>কখন provider-এর সঙ্গে যোগাযোগ করবেন</h2>
        <p>Ethernet-এও সব service ধীর, দিনের নির্দিষ্ট সময়ে বারবার গতি পড়ে, connection disconnect হয় অথবা provider-এর plan-এর তুলনায় ধারাবাহিকভাবে অনেক কম baseline পাওয়া গেলে সময়, device, test result ও error note করুন। এই evidence নিয়ে ISP support-এ গেলে সমস্যা ব্যাখ্যা করা সহজ হয়। Billing plan, fair-use limit এবং outage status-ও যাচাই করুন।</p>
        <h2>ডেটা ও quality-এর ভারসাম্য</h2>
        <p>Speed বাড়ালেই মাসিক data allowance বাড়ে না। Mobile বা capped connection ব্যবহার করলে resolution কমানো data বাঁচাতে পারে। বিস্তারিত হিসাবের জন্য আমাদের <a href="/articles/ভিডিও-স্ট্রিমিংয়ে-কত-ডেটা-লাগে-কোয়ালিটি-ও-খরচের-গাইড-193f727c">ভিডিও data usage guide</a> এবং সমস্যা আলাদা করার জন্য <a href="/articles/লাইভ-স্ট্রিম-বারবার-বাফার-করলে-কী-করবেন-ধাপে-ধাপে-সমাধান-26dd31c2">buffering checklist</a> দেখুন।</p>
        <h2>সূত্র ও আরও পড়ুন</h2>
        <ul>
          <li><a href="https://support.google.com/youtube/answer/3037019?hl=en" ${LINK_ATTRS}>YouTube Help: troubleshoot streaming and video issues</a> — resolution অনুযায়ী recommended sustained speed ও troubleshooting steps।</li>
          <li><a href="https://support.google.com/youtube/answer/78358?hl=en" ${LINK_ATTRS}>YouTube system requirements</a> — supported browser, operating system ও playback guidance।</li>
        </ul>
        <p><strong>সম্পাদকের নোট:</strong> এই guide ৩ আগস্ট ২০২৬ তারিখে official documentation দেখে review করা হয়েছে। Service, device ও router model অনুযায়ী menu এবং performance বদলাতে পারে।</p>
      </section>
    `,
  },
  {
    id: "b28d0512-static-cast-airplay",
    title: "ফোন বা ল্যাপটপ থেকে TV-তে ভিডিও দেখবেন যেভাবে",
    seo_title: "ফোন বা ল্যাপটপ থেকে TV-তে ভিডিও দেখার গাইড",
    seo_description: "Google Cast, AirPlay ও screen mirroring-এর পার্থক্য, setup, privacy এবং common connection সমস্যা সমাধানের সহজ গাইড।",
    content_type: "article",
    featured_image_url: "/editorial/cast-airplay-tv.webp",
    published_at: "2026-08-03T11:00:00.000+06:00",
    updated_at: "2026-08-03T11:00:00.000+06:00",
    is_published: true,
    position: 9,
    content_html: `
      <section>
        <p>ছোট phone বা laptop-এর video বড় TV-তে দেখার তিনটি পরিচিত পথ হলো Google Cast, Apple AirPlay এবং screen mirroring। দেখতে একই মনে হলেও এগুলোর কাজ আলাদা। Supported app থেকে cast করলে TV বা streaming device সাধারণত নিজেই stream নেয়, আর phone remote control হিসেবে কাজ করে। Mirroring-এ phone বা computer-এর পুরো screen TV-তে প্রতিফলিত হয়। সঠিক পদ্ধতি বাছলে quality, battery এবং privacy—তিনটিই ভালো থাকে।</p>
        <h2>শুরু করার আগে যা মিলিয়ে নেবেন</h2>
        <ul>
          <li>TV বা connected streaming device Cast, AirPlay বা আপনার ব্যবহৃত mirroring standard support করে কি না দেখুন।</li>
          <li>Phone, computer ও TV একই trusted Wi-Fi network-এ রাখুন। Guest network device discovery বন্ধ রাখতে পারে।</li>
          <li>TV firmware, mobile operating system, browser এবং streaming app update করুন।</li>
          <li>যে content দেখবেন তার official app বা licensed website ব্যবহার করুন।</li>
          <li>TV-তে input/source সঠিক আছে এবং device sleep mode-এ নেই নিশ্চিত করুন।</li>
        </ul>
        <h2>Google Cast দিয়ে দেখার সাধারণ ধাপ</h2>
        <p>Supported mobile app খুলে Cast icon নির্বাচন করুন, তালিকা থেকে সঠিক TV বা device বেছে নিন এবং content play করুন। Google-এর documentation অনুযায়ী phone বা tablet এবং Cast device একই Wi-Fi-তে থাকা দরকার। iPhone বা iPad-এ app-এর Local Network permission প্রয়োজন হতে পারে। Playback চললে phone দিয়ে pause, seek ও volume control করা যায়, তবে control-এর ধরন app ভেদে বদলায়।</p>
        <p>Chrome থেকে supported website cast করতে browser menu-এর Cast, save and share option ব্যবহার করা যায়। একটি tab cast এবং পুরো screen cast এক নয়। শুধু video tab দিলে personal notification বা অন্য window দেখানোর ঝুঁকি কমে। Browser casting-এর সময় computer ও receiver একই network-এ রাখুন এবং Chrome current version ব্যবহার করুন।</p>
        <h2>AirPlay দিয়ে দেখার সাধারণ ধাপ</h2>
        <p>Apple-এর official instructions অনুযায়ী iPhone, iPad বা Mac এবং AirPlay-compatible TV একই Wi-Fi network-এ রাখুন। Supported app-এ AirPlay button বা system-এর Screen Mirroring control থেকে TV নির্বাচন করুন। TV-তে passcode দেখালে sender device-এ সেটি দিন। Video শেষ হলে একই control থেকে AirPlay বা mirroring বন্ধ করুন।</p>
        <h2>Cast আর screen mirroring কখন ব্যবহার করবেন</h2>
        <p>App-এ native Cast বা AirPlay button থাকলে সাধারণত সেটিই ভালো: phone অন্য কাজে ব্যবহার করা যায় এবং incoming notification TV-তে দেখানোর সম্ভাবনা কম। App support না করলে mirroring কাজে লাগতে পারে, কিন্তু পুরো screen, notification, message preview বা browser tab বড় screen-এ দেখা যেতে পারে। Shared room-এ mirroring চালুর আগে Do Not Disturb এবং sensitive app বন্ধ করুন।</p>
        <h2>TV পাওয়া না গেলে diagnostic checklist</h2>
        <ol>
          <li>দুই device একই Wi-Fi name ব্যবহার করছে কি না দেখুন; mobile data সাময়িকভাবে বন্ধ করে পরীক্ষা করুন।</li>
          <li>App-এর local-network permission এবং router-এর client isolation setting পরীক্ষা করুন।</li>
          <li>App, TV এবং phone restart করে আবার device list refresh করুন।</li>
          <li>অন্য একটি supported app দিয়ে test করুন—তাতে hardware ও নির্দিষ্ট app-এর সমস্যা আলাদা হবে।</li>
          <li>VPN বা security software discovery আটকাচ্ছে কি না trusted environment-এ যাচাই করুন।</li>
        </ol>
        <h2>Quality ও buffering নিয়ন্ত্রণ</h2>
        <p>Mirroring-এ sender device থেকে local network-এর ওপর অতিরিক্ত চাপ পড়তে পারে। TV ও router-এর দূরত্ব, crowded Wi-Fi এবং household download playback নষ্ট করতে পারে। সমস্যায় quality কমিয়ে, router-এর কাছে গিয়ে বা supported wired connection দিয়ে test করুন। আরও বিস্তারিত diagnosis-এর জন্য আমাদের <a href="/articles/স্মুথ-ভিডিও-স্ট্রিমিংয়ের-জন্য-wi-fi-ও-ইন্টারনেট-ঠিক-করার-গাইড-a17c9401">Wi-Fi streaming guide</a> ব্যবহার করুন।</p>
        <h2>Account ও privacy নিরাপদ রাখুন</h2>
        <p>Hotel, office বা অন্যের TV-তে permanent sign-in এড়িয়ে চলুন। Pairing code শুধু নিজের দেখা screen থেকে নিন, অচেনা casting request reject করুন এবং কাজ শেষে cast session বন্ধ করে account/device list review করুন। Mirroring বন্ধ হয়েছে ধরে না নিয়ে sender ও TV—দুই জায়গায় status দেখুন। Shared network-এ private photo, banking screen বা personal message mirror করবেন না।</p>
        <h2>সূত্র ও আরও পড়ুন</h2>
        <ul>
          <li><a href="https://support.google.com/chromecast/answer/3228332?hl=en" ${LINK_ATTRS}>Google Cast Help: cast from Chrome</a> — computer ও Chrome থেকে tab বা screen cast করার official guidance।</li>
          <li><a href="https://support.google.com/googlecast/answer/3006709?hl=en" ${LINK_ATTRS}>Google Cast-enabled apps</a> — mobile app, Wi-Fi ও supported device setup।</li>
          <li><a href="https://support.apple.com/en-us/102661" ${LINK_ATTRS}>Apple Support: stream video or mirror the screen</a> — AirPlay-compatible device-এর official steps।</li>
        </ul>
        <p><strong>সম্পাদকের নোট:</strong> Button ও menu-এর নাম software version এবং manufacturer অনুযায়ী বদলাতে পারে। সন্দেহ হলে device maker-এর বর্তমান manual অনুসরণ করুন।</p>
      </section>
    `,
  },
  {
    id: "c39e1623-static-smart-tv-security",
    title: "Smart TV ও home network নিরাপদ রাখার ব্যবহারিক checklist",
    seo_title: "Smart TV ও Home Network Security Checklist",
    seo_description: "Smart TV update, account, app permission, router ও privacy settings নিরাপদ রাখার সহজ এবং বাস্তবধর্মী checklist।",
    content_type: "article",
    featured_image_url: "/editorial/smart-tv-security.webp",
    published_at: "2026-08-03T10:00:00.000+06:00",
    updated_at: "2026-08-03T10:00:00.000+06:00",
    is_published: true,
    position: 10,
    content_html: `
      <section>
        <p>Smart TV আসলে internet-connected computer-এর মতো: এতে operating system, app, account, microphone, network connection এবং কখনো camera থাকে। তাই শুধু picture setting ঠিক করলেই দায়িত্ব শেষ নয়। Default password, পুরোনো firmware, অপ্রয়োজনীয় permission বা shared account বাড়ির অন্য connected device ও ব্যক্তিগত তথ্যের ঝুঁকি বাড়াতে পারে। কয়েকটি নিয়মিত অভ্যাসে এই ঝুঁকি অনেকটাই নিয়ন্ত্রণ করা যায়।</p>
        <h2>প্রথম দিনের setup নিরাপদ করুন</h2>
        <ol>
          <li>TV ও router-এর default administrator password বদলে আলাদা, দীর্ঘ password দিন।</li>
          <li>Manufacturer-এর official update option থেকে firmware এবং security update install করুন।</li>
          <li>যেসব feature ব্যবহার করবেন না—remote access, voice activation, camera বা diagnostics—settings দেখে বন্ধ করুন।</li>
          <li>শুধু official app store থেকে প্রয়োজনীয় app install করুন।</li>
          <li>Privacy notice ও data-sharing option পড়ে advertising personalization বা viewing-data collection নিজের পছন্দ অনুযায়ী ঠিক করুন।</li>
        </ol>
        <h2>Router হলো বাড়ির digital দরজা</h2>
        <p>CISA-এর connected-device guidance home Wi-Fi router secure করা, software update রাখা এবং strong authentication ব্যবহারের ওপর জোর দেয়। Router-এর admin page internet থেকে সরাসরি accessible না রাখাই সাধারণত নিরাপদ, যদি আপনার বিশেষ প্রয়োজন না থাকে। WPA2 বা WPA3-এর মতো supported encryption বেছে নিন; পুরোনো বা open security mode এড়িয়ে চলুন। Router model অনুযায়ী exact menu আলাদা, তাই official manual অনুসরণ করুন।</p>
        <p>Guest-এর জন্য আলাদা guest Wi-Fi ব্যবহার করলে main network-এর device exposure কমতে পারে। কিছু router IoT device-এর জন্য আলাদা network বা client isolation দেয়। Feature চালুর আগে casting, printer বা local media sharing কাজ করে কি না পরীক্ষা করুন, কারণ isolation device discovery বন্ধ করতে পারে। Security এবং convenience-এর মধ্যে আপনার ব্যবহারের জন্য সচেতন balance দরকার।</p>
        <h2>Account ও password ব্যবস্থাপনা</h2>
        <p>একই password TV maker, email ও streaming service-এ পুনরায় ব্যবহার করবেন না। সম্ভব হলে two-step verification চালু করুন। Shared TV-তে child বা guest profile ব্যবহার করুন এবং purchase PIN দিন। পুরোনো TV বিক্রি, ফেরত বা অন্যকে দেওয়ার আগে প্রতিটি app থেকে sign out, linked-device list থেকে remove এবং manufacturer-এর documented factory reset করুন। শুধু app delete করলে account session সবসময় শেষ হয় না।</p>
        <h2>App permission কমিয়ে রাখুন</h2>
        <p>একটি weather বা video app-এর microphone, contact বা precise location দরকার কি না প্রশ্ন করুন। Permission ব্যবহার না হলে revoke করুন। অচেনা APK, “free premium channel”, cracked app বা browser pop-up থেকে software install করবেন না। এগুলো copyright সমস্যা ছাড়াও credential theft বা unwanted tracking-এর পথ হতে পারে। আমাদের <a href="/articles/অনলাইনে-বাংলাদেশি-টিভি-বৈধ-ও-নিরাপদভাবে-দেখার-গাইড-5474a282">নিরাপদে online TV দেখার guide</a>-এ source যাচাইয়ের আরও লক্ষণ আছে।</p>
        <h2>Microphone, camera ও viewing data</h2>
        <p>Voice search সুবিধাজনক, কিন্তু microphone কখন সক্রিয় হয় এবং recording history কোথায় manage করা যায় তা জানুন। TV-তে camera থাকলে ব্যবহার না করার সময় supported privacy shutter ব্যবহার করুন। Automatic content recognition বা viewing-data feature manufacturer ভেদে আলাদা নামে থাকতে পারে। Consent screen দ্রুত accept না করে purpose, sharing এবং opt-out method পড়ুন।</p>
        <h2>মাসিক পাঁচ মিনিটের security review</h2>
        <ul>
          <li>TV, streaming stick ও router update pending আছে কি না দেখুন।</li>
          <li>Installed app list থেকে ব্যবহার না করা app সরান।</li>
          <li>Account-এর active session ও connected device review করুন।</li>
          <li>Unexpected purchase, login alert বা data usage খেয়াল করুন।</li>
          <li>Backup email, recovery phone ও purchase PIN এখনও সঠিক কি না নিশ্চিত করুন।</li>
        </ul>
        <h2>সমস্যার লক্ষণ পেলে কী করবেন</h2>
        <p>অচেনা app, নিজে থেকে setting বদল, unexpected login alert বা account charge দেখলে TV network থেকে disconnect করুন, trusted phone/computer থেকে account password বদলান এবং sessions revoke করুন। তারপর official support ও payment provider-এর নির্দেশনা নিন। সন্দেহজনক link বা caller-কে remote access দেবেন না। প্রয়োজন হলে router ও TV reset করার আগে configuration ও purchase evidence সংরক্ষণ করুন।</p>
        <h2>সূত্র ও আরও পড়ুন</h2>
        <ul>
          <li><a href="https://www.cisa.gov/sites/default/files/publications/Internet%20of%20Things%20Tip%20Card_3.pdf" ${LINK_ATTRS}>CISA: Internet of Things Tip Card</a> — connected device, password, update ও network security guidance।</li>
          <li><a href="https://niccs.cisa.gov/sites/default/files/documents/pdf/ncsam_5stepsprotectingdigitalhome_508.pdf" ${LINK_ATTRS}>CISA: protecting your digital home</a> — home router ও connected-device hygiene-এর practical steps।</li>
        </ul>
        <p><strong>সম্পাদকের নোট:</strong> এটি সাধারণ educational checklist, কোনো specific product-এর security guarantee নয়। আপনার TV ও router manufacturer-এর current security notice অগ্রাধিকার পাবে।</p>
      </section>
    `,
  },
  {
    id: "d4af2734-static-family-viewing",
    title: "পরিবারের জন্য নিরাপদ screen time ও video viewing পরিকল্পনা",
    seo_title: "শিশুদের নিরাপদ Screen Time ও Video Viewing Guide",
    seo_description: "Parental controls, supervised account, screen-time routine ও family discussion মিলিয়ে শিশুদের নিরাপদ video viewing পরিকল্পনা তৈরি করুন।",
    content_type: "article",
    featured_image_url: "/editorial/family-safe-viewing.webp",
    published_at: "2026-08-03T09:00:00.000+06:00",
    updated_at: "2026-08-03T09:00:00.000+06:00",
    is_published: true,
    position: 11,
    content_html: `
      <section>
        <p>শিশুর online video নিরাপদ রাখা শুধু একটি “kids mode” চালুর বিষয় নয়। Content selection, recommendation, বিজ্ঞাপন, comment, purchase, privacy এবং ঘুম বা পড়াশোনার routine—সব মিলিয়ে family plan দরকার। প্রযুক্তিগত parental control সহায়ক, কিন্তু বয়স অনুযায়ী আলোচনা, পাশে বসে দেখা এবং নিয়মিত review-এর বিকল্প নয়। পরিকল্পনাটি যত সহজ ও দৃশ্যমান হবে, পরিবারের সবার পক্ষে মানা তত সহজ হবে।</p>
        <h2>প্রথমে পরিবারের নিয়ম একসঙ্গে ঠিক করুন</h2>
        <p>কখন, কোথায় এবং কতক্ষণ screen ব্যবহার হবে তা পরিষ্কার ভাষায় লিখুন। Homework, meal এবং bedtime-এর সময় device কোথায় থাকবে ঠিক করুন। শুধু শিশুর জন্য নিয়ম দিলে সেটি শাস্তির মতো মনে হতে পারে; বড়রাও meal-এর সময় phone না দেখা বা রাতে common charging area ব্যবহার করার মতো নিয়ম মানলে model তৈরি হয়। বয়স ও স্কুল routine বদলালে plan review করুন।</p>
        <h2>সঠিক account ও content level বেছে নিন</h2>
        <p>Adult account শিশুকে দিয়ে ব্যবহার না করিয়ে supported supervised account বা child profile ব্যবহার করুন। YouTube-এর supervised experience-এ parent content setting বেছে নিতে পারেন, তবে Google নিজেই জানায় যে automated system সব অনুপযুক্ত video নিখুঁতভাবে আটকাতে পারে না। তাই setting-কে guarantee না ধরে একটি layer হিসেবে দেখুন। YouTube Kids-এ search, autoplay, approved content এবং history-related control review করা যায়।</p>
        <h2>Screen-time control কী করতে পারে</h2>
        <p>Google Family Link-এর official help অনুযায়ী supported child device-এ daily limit, app limit, downtime এবং remote lock set করা যায়। কিন্তু timer কোনো video-এর সত্যতা বা মান বিচার করে না। Educational content হলেও দীর্ঘ সময় একভাবে বসে থাকা, late-night viewing বা autoplay routine নষ্ট করতে পারে। অন্যদিকে family video call বা homework research-এর উদ্দেশ্য আলাদা। তাই শুধু মিনিট নয়, purpose ও context-ও দেখুন।</p>
        <h2>Practical weekly setup</h2>
        <ol>
          <li>Child profile, age/content level এবং search option review করুন।</li>
          <li>Autoplay প্রয়োজন না হলে বন্ধ করুন, যাতে একটি video থেকে অনির্দিষ্ট viewing না হয়।</li>
          <li>Purchase-এর জন্য password বা parent approval দিন।</li>
          <li>Bedtime-এর আগে device common জায়গায় charge করার নিয়ম করুন।</li>
          <li>সপ্তাহে একবার watch history, নতুন subscription এবং reported concern নিয়ে কথা বলুন।</li>
        </ol>
        <h2>ভয় দেখানো নয়, কথা বলার পথ খোলা রাখুন</h2>
        <p>শিশুকে বলুন অস্বস্তিকর, ভয়ংকর বা confusing video এলে সে যেন screen বন্ধ করে trusted adult-কে জানায়—এতে তার দোষ নেই। অচেনা link, giveaway, private chat, personal photo request এবং “secret রাখো” ধরনের message-এর ঝুঁকি বয়স উপযোগী উদাহরণে বোঝান। কঠোর শাস্তির ভয় থাকলে শিশু সমস্যা লুকাতে পারে; শান্তভাবে report করার অভ্যাস বেশি কার্যকর।</p>
        <h2>Privacy ও commercial content বুঝতে শেখান</h2>
        <p>Full name, school, address, phone, location বা password comment ও live chat-এ না দেওয়ার নিয়ম করুন। Influencer recommendation, paid promotion এবং সাধারণ entertainment-এর পার্থক্য নিয়ে কথা বলুন। “ভিডিওতে বলেছে” মানেই সত্য নয়। বড় শিশুকে source, upload date এবং অন্য reliable source দিয়ে claim মিলিয়ে দেখতে শেখান। আমাদের <a href="/articles/ব্রেকিং-নিউজের-ভিডিও-ও-ছবি-শেয়ার-করার-আগে-যাচাই-করুন-e5b03845">news verification guide</a> একসঙ্গে practice করা যায়।</p>
        <h2>Accessibility-ও safety-এর অংশ</h2>
        <p>Caption, readable text, appropriate volume এবং screen distance viewing আরামদায়ক করে। Hearing difficulty, language learning বা noisy room-এ caption সাহায্য করতে পারে। Caption চালুর পদ্ধতির জন্য আমাদের <a href="/articles/ক্যাপশন-অ্যাক্সেসিবিলিটি-ও-টিভিতে-কাস্টিং-সবার-জন্য-ভালো-দেখার-অভিজ্ঞতা-313b1b73">caption ও accessibility guide</a> দেখুন। চোখে চাপ, ঘুমে সমস্যা বা আচরণে উদ্বেগ থাকলে qualified health professional-এর পরামর্শ নিন।</p>
        <h2>Control কাজ করছে কি না পরীক্ষা করুন</h2>
        <p>Setting save করার পর child profile দিয়ে নিজে পরীক্ষা করুন। Search result, autoplay, app install, purchase এবং bedtime limit expected ভাবে কাজ করছে কি না দেখুন। Operating system বা app update-এর পরে setting বদলেছে কি না আবার review করুন। Shared TV, game console এবং browser-ও plan-এর মধ্যে ধরুন; শুধু phone control করলে অন্য screen খোলা থেকে যায়।</p>
        <h2>সূত্র ও আরও পড়ুন</h2>
        <ul>
          <li><a href="https://support.google.com/families/answer/7103340?hl=en" ${LINK_ATTRS}>Google Family Link: manage screen time</a> — daily limit, app limit, downtime ও lock guidance।</li>
          <li><a href="https://support.google.com/youtube/answer/10314940?hl=en" ${LINK_ATTRS}>YouTube supervised experience</a> — content settings ও documented limitations।</li>
          <li><a href="https://support.google.com/youtubekids/answer/7554371?hl=en" ${LINK_ATTRS}>YouTube Kids parental controls</a> — search, autoplay, approved content ও history controls।</li>
        </ul>
        <p><strong>সম্পাদকের নোট:</strong> শিশু, দেশ ও device অনুযায়ী available feature এবং age requirement বদলাতে পারে। Parent বা guardian-কে বর্তমান official terms ও settings যাচাই করতে হবে।</p>
      </section>
    `,
  },
  {
    id: "e5b03845-static-news-verification",
    title: "ব্রেকিং নিউজের ভিডিও ও ছবি শেয়ার করার আগে যাচাই করুন",
    seo_title: "News Video ও ছবি যাচাই করার Step-by-Step Guide",
    seo_description: "Breaking-news video বা ছবি সত্য কি না বোঝার জন্য source, date, location, context ও reverse image clues যাচাই করার ধাপে ধাপে গাইড।",
    content_type: "article",
    featured_image_url: "/editorial/news-video-verification.webp",
    published_at: "2026-08-03T08:00:00.000+06:00",
    updated_at: "2026-08-03T08:00:00.000+06:00",
    is_published: true,
    position: 12,
    content_html: `
      <section>
        <p>Breaking news-এর সময় একটি dramatic video বা ছবি কয়েক মিনিটে হাজার মানুষের কাছে পৌঁছে যেতে পারে। কিন্তু সত্যিকারের media হলেও সেটি পুরোনো, অন্য দেশের, cropped বা ভুল caption-সহ পুনরায় শেয়ার হতে পারে। আবার edited বা AI-generated visual-ও real event হিসেবে ছড়াতে পারে। দ্রুত share করার আগে কয়েক মিনিটের structured verification ভুল তথ্যের ক্ষতি কমায়।</p>
        <h2>প্রথমে claim-টি স্পষ্ট করে লিখুন</h2>
        <p>Post আসলে কী দাবি করছে—ঘটনা, স্থান, তারিখ, ব্যক্তি ও source আলাদা করে লিখুন। “এইমাত্র ঢাকায়” এবং “বাংলাদেশে” একই precision নয়। Caption না থাকলে visual নিজে কী প্রমাণ করে এবং কী প্রমাণ করে না সেটিও note করুন। একটি আগুনের video আগুন দেখায়; শুধু video দেখে location, cause বা casualty নিশ্চিত হয় না।</p>
        <h2>Original source খুঁজুন</h2>
        <p>যে account থেকে পেয়েছেন সেটি প্রথম uploader কি না দেখুন। Repost, screen recording বা watermark কেটে দেওয়া হলে caption-এর গুরুত্বপূর্ণ context হারাতে পারে। Account কবে তৈরি, আগে কী ধরনের post করেছে এবং correction history আছে কি না দেখুন। “Verified” badge identity সম্পর্কে signal দিতে পারে, কিন্তু প্রতিটি claim সত্য হওয়ার guarantee নয়। Official agency বা প্রতিষ্ঠানের website এবং confirmed social account-এ একই announcement আছে কি না মিলিয়ে নিন।</p>
        <h2>Date ও location যাচাই করুন</h2>
        <p>Upload time ঘটনার সময় নয়—পুরোনো footage নতুন করে upload হতে পারে। Weather, daylight, language, road sign, vehicle, building, landscape এবং shadow location বা সময়ের clue দেয়। তবে একটিমাত্র clue দিয়ে সিদ্ধান্ত নেবেন না। Google-এর “About this image” feature available হলে image কখন Google প্রথম দেখেছে, অন্য page কীভাবে ব্যবহার করেছে এবং metadata-related context পাওয়া যেতে পারে। সব image বা region-এ একই তথ্য নাও থাকতে পারে।</p>
        <h2>Image বা key frame দিয়ে খুঁজুন</h2>
        <ol>
          <li>Video-র পরিষ্কার একটি frame screenshot নিন—logo বা caption দিয়ে মূল দৃশ্য ঢেকে ফেলবেন না।</li>
          <li>Google Lens বা অন্য reputable visual-search tool দিয়ে মিল আছে এমন পুরোনো page খুঁজুন।</li>
          <li>সবচেয়ে পুরোনো পাওয়া result-এর date, headline ও location পড়ুন।</li>
          <li>Cropped result হলে wider/original version খুঁজে দেখুন context বদলায় কি না।</li>
          <li>একাধিক independent reliable source একই event report করেছে কি না যাচাই করুন।</li>
        </ol>
        <h2>Audio ও editing clue দেখুন</h2>
        <p>Lip movement ও sound sync, abrupt cut, repeated crowd, inconsistent reflection বা অসম্ভব shadow সন্দেহ তৈরি করতে পারে। কিন্তু compression, slow connection এবং platform processing-ও distortion তৈরি করে। তাই visual anomaly একা “fake” প্রমাণ নয়। Audio অন্য clip থেকে বসানো হতে পারে; গুরুত্বপূর্ণ বক্তব্যের full recording, transcript বা official statement খুঁজুন। AI detector-এর single score-কে final verdict হিসেবে ব্যবহার করবেন না।</p>
        <h2>Reliable coverage কীভাবে তুলনা করবেন</h2>
        <p>একই claim copy করা দশটি site দশটি independent confirmation নয়। প্রতিবেদনে reporter name, location, direct evidence, named source, correction policy এবং update time আছে কি না দেখুন। Google Search-এর information-evaluation guidance source সম্পর্কে কী বলা হয়েছে, author expertise এবং অন্য source-এর consensus দেখার পরামর্শ দেয়। Sensitive health, safety বা election claim-এর ক্ষেত্রে সংশ্লিষ্ট primary authority-কে অগ্রাধিকার দিন।</p>
        <h2>নিশ্চিত না হলে কীভাবে share করবেন</h2>
        <p>Verification অসম্পূর্ণ হলে share না করাই নিরাপদ। জনস্বার্থে উল্লেখ করতেই হলে “এটি যাচাই করা যায়নি” স্পষ্ট করে লিখুন, sensational caption বাদ দিন এবং source link দিন। কারও মুখ, বাড়ি, vehicle plate বা শিশুর পরিচয় অপ্রয়োজনে ছড়াবেন না। দুর্ঘটনা বা সহিংসতার graphic visual victim ও পরিবারের privacy ক্ষতিগ্রস্ত করতে পারে। ভুল share করলে original post edit/delete করার পাশাপাশি একই audience-এর কাছে correction দিন।</p>
        <h2>নিজের দুই মিনিটের checklist</h2>
        <ul>
          <li>কে প্রথম প্রকাশ করেছে এবং তার প্রমাণ কী?</li>
          <li>Original date, location ও full context পাওয়া গেছে কি?</li>
          <li>কমপক্ষে দুইটি independent reliable source কী বলছে?</li>
          <li>Headline কি report-এর চেয়ে বেশি দাবি করছে?</li>
          <li>Share করলে কার privacy, safety বা reputation ক্ষতিগ্রস্ত হতে পারে?</li>
        </ul>
        <p>আমাদের প্রকাশিত লেখাতেও ভুল দেখলে <a href="/corrections-policy">Corrections Policy</a> অনুযায়ী জানান। আমরা source ও revision date দৃশ্যমান রাখার চেষ্টা করি; বিস্তারিত <a href="/editorial-policy">Editorial Policy</a>-তে আছে।</p>
        <h2>সূত্র ও আরও পড়ুন</h2>
        <ul>
          <li><a href="https://support.google.com/websearch/answer/12003459?hl=en" ${LINK_ATTRS}>Google Search Help: evaluate information</a> — source, author ও corroboration যাচাইয়ের guidance।</li>
          <li><a href="https://support.google.com/websearch/answer/14177408?hl=en" ${LINK_ATTRS}>Google Search Help: About this image</a> — image history, usage ও available context দেখার official instructions।</li>
        </ul>
        <p><strong>সম্পাদকের নোট:</strong> Verification একটি evidence-based process; কোনো একক tool সব manipulated বা miscaptioned media শনাক্ত করতে পারে না। নতুন evidence এলে conclusion update করুন।</p>
      </section>
    `,
  },
];
