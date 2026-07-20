(function(){
  const icons = {
    search: '<svg class="heroIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m21 21-5.2-5.2m1.7-4.3a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    warning: '<svg class="heroIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 9v4m0 4h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    clipboard: '<svg class="heroIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 5h6m-7 4h8m-8 4h8m-8 4h5M9 3.8A2.2 2.2 0 0 1 11.2 2h1.6A2.2 2.2 0 0 1 15 3.8M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    book: '<svg class="heroIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 6.5A6.5 6.5 0 0 0 5.5 4H4v15h1.5A6.5 6.5 0 0 1 12 21m0-14.5A6.5 6.5 0 0 1 18.5 4H20v15h-1.5A6.5 6.5 0 0 0 12 21m0-14.5V21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    sparkles: '<svg class="heroIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Zm6.5 9 1 2.5L22 15.5l-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5ZM5 13l1.1 3L9 17.1l-2.9 1.1L5 21l-1.1-2.8L1 17.1 3.9 16 5 13Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    eye: '<svg class="heroIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" stroke-width="2"/></svg>',
    list: '<svg class="heroIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    grid: '<svg class="heroIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    refresh: '<svg class="heroIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.8-4.2M4 5v5h5m-5 3a8 8 0 0 0 14.8 4.2M20 19v-5h-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    share: '<svg class="heroIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8.5 12.5 15.5 16m0-8-7 3.5M18 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6 15a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm12 4.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    download: '<svg class="heroIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    id: '<svg class="heroIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Zm4 5h4m-4 4h8m-1-6h2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    back: '<svg class="heroIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 19 3 12l7-7M4 12h17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    map: '<svg class="fieldIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 18-5 2V6l5-2 6 2 5-2v14l-5 2-6-2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 4v14M15 6v14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    pin: '<svg class="fieldIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s7-5.2 7-12A7 7 0 1 0 5 9c0 6.8 7 12 7 12Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" stroke="currentColor" stroke-width="2"/></svg>',
    tree: '<svg class="fieldIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21v-7M7 14h10M12 14c-4 0-7-2.8-7-6.2C5 4.8 7.5 3 10.4 3c.7 0 1.2.2 1.6.6.4-.4.9-.6 1.6-.6C16.5 3 19 4.8 19 7.8c0 3.4-3 6.2-7 6.2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    ruler: '<svg class="fieldIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 17 17 4l3 3L7 20l-3-3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="m9 12 2 2m1-5 2 2m1-5 2 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    calendar: '<svg class="fieldIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 5h16M8 3v4m8-4v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    heart: '<svg class="fieldIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20s-7-4.4-9-9.2C1.7 7.6 3.7 5 6.7 5c1.8 0 3.1.9 3.9 2.1C11.3 5.9 12.7 5 14.5 5c3 0 5 2.6 3.7 5.8C16.8 14.2 12 20 12 20Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M7 12h3l1.5-3 2 6 1.5-3h2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    truck: '<svg class="fieldIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 6h11v10H3V6Zm11 3h4l3 4v3h-7V9Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke="currentColor" stroke-width="2"/></svg>',
    wrench: '<svg class="fieldIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14.5 5.5a5 5 0 0 0 4.8 6.4L11 20.2a3 3 0 0 1-4.2-4.2l8.3-8.3a5 5 0 0 0-.6-2.2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    scissors: '<svg class="fieldIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m4 4 16 16M4 20l16-16M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    building: '<svg class="fieldIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M3 21h18M8 7h4M8 11h4M8 15h4M16 9h2a2 2 0 0 1 2 2v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
  };

  const labelToIcon = new Map([
    ["你能查什麼", "search"],
    ["你應該要知道的資訊差", "warning"],
    ["樹木的生命履歷", "clipboard"],
    ["樹種科普", "book"],
    ["今天給我一棵樹", "sparkles"],
    ["綜合搜尋", "search"],
    ["用編號找", "id"],
    ["用地點找", "search"],
    ["用樹種找", "book"],
    ["查驗", "search"],
    ["看這種樹", "eye"],
    ["列表", "list"],
    ["卡片", "grid"],
    ["換另一棵樹", "refresh"],
    ["分享今天這棵樹", "share"],
    ["下載分享圖片", "download"],
    ["看樹種排行榜", "list"],
    ["查一棵樹履歷", "id"],
    ["重新查詢", "refresh"],
    ["返回查詢", "back"]
  ]);

  const fieldToIcon = new Map([
    ["樹木編號", "id"],
    ["行政區", "map"],
    ["道路名稱", "map"],
    ["位置備註", "pin"],
    ["樹種", "tree"],
    ["胸徑", "ruler"],
    ["樹高", "ruler"],
    ["調查日期", "calendar"],
    ["座標", "pin"],
    ["樹目前是否健康", "heart"],
    ["是否已核准移植", "truck"],
    ["是否正被工程影響", "wrench"],
    ["為何被移除", "warning"],
    ["移植到哪裡", "truck"],
    ["移植後是否存活", "heart"],
    ["上次修剪多少比例", "scissors"],
    ["樹冠是否已被截頂", "scissors"],
    ["工程前後差異", "clipboard"],
    ["是否為公園樹或校園內部樹籍", "building"]
  ]);

  function plainLabel(element){
    return Array.from(element.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent)
      .join("")
      .trim() || element.textContent.trim();
  }

  function addIcons(){
    document
      .querySelectorAll(".navLinks a, .searchInput button, .button, .secondaryButton, .viewToggle button, .modeButton")
      .forEach(element => {
        if(element.querySelector(".heroIcon")) return;
        const iconName = labelToIcon.get(plainLabel(element));
        if(!iconName) return;
        element.insertAdjacentHTML("afterbegin", icons[iconName]);
      });

    document.querySelectorAll(".fieldItem").forEach(element => {
      if(element.querySelector(".fieldIcon")) return;
      const label = element.textContent.replace(/[✓×]/g, "").trim();
      const iconName = fieldToIcon.get(label);
      if(!iconName) return;
      element.insertAdjacentHTML("beforeend", icons[iconName]);
    });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", addIcons);
  }else{
    addIcons();
  }
})();
