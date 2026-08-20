(function(){
  "use strict";

  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const numberTargets = new Set(["tree-count","species-count","card-count"]);
  const modalFocusableSelector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])'
  ].join(",");

  function trapModalFocus(modal, event){
    if(!modal || event.key !== "Tab") return;
    const focusable = [...modal.querySelectorAll(modalFocusableSelector)]
      .filter(element => element.getClientRects().length > 0);
    if(!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if(event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))){
      event.preventDefault();
      last.focus();
    }else if(!event.shiftKey && document.activeElement === last){
      event.preventDefault();
      first.focus();
    }
  }

  if(!gsap || reduceMotion){
    window.TPTreesMotion = {
      openModal(modal, ready){ if(typeof ready === "function") ready(); },
      closeModal(modal, done){ if(typeof done === "function") done(); },
      trapModalFocus,
      revealDynamic(){},
      animateNumber(){}
    };
    return;
  }

  if(ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  function visibleElements(selector, scope=document){
    return Array.from(scope.querySelectorAll(selector)).filter(element => {
      if(element.dataset.motionReady === "true") return false;
      element.dataset.motionReady = "true";
      return true;
    });
  }

  function revealBatch(elements, options={}){
    if(!elements.length) return;
    const from = {
      autoAlpha:0,
      y:options.y ?? 22,
      scale:options.scale ?? 1,
      duration:options.duration ?? .68,
      stagger:options.stagger ?? .08,
      ease:options.ease || "power3.out",
      clearProps:"opacity,visibility,transform"
    };

    if(!ScrollTrigger){
      gsap.from(elements, from);
      return;
    }

    ScrollTrigger.batch(elements, {
      start:"top 88%",
      once:true,
      onEnter(batch){ gsap.from(batch, from); }
    });
  }

  function revealPage(){
    revealBatch(visibleElements(".heroCopy > *, .heroIntro > *"), {y:18, stagger:.07});
    revealBatch(visibleElements(".mapPanel, .searchBox, .searchCard, .heroControls, .treeCard"), {y:26, scale:.985, stagger:.1});
    revealBatch(visibleElements(".fieldItem, .timeline > div, .gapCard, .noteCard, .step, .heroStep"), {y:20, stagger:.065});
    revealBatch(visibleElements(".closing > *, .sectionHeader > *"), {y:18, stagger:.06});
  }

  function numberParts(element){
    const raw = element.textContent.trim();
    const match = raw.match(/^(.*?)([\d,]+(?:\.\d+)?)(.*)$/);
    if(!match) return null;
    const value = Number(match[2].replaceAll(",",""));
    if(!Number.isFinite(value)) return null;
    return {prefix:match[1], value, suffix:match[3], decimals:(match[2].split(".")[1] || "").length};
  }

  function animateNumber(element){
    if(!element || !numberTargets.has(element.id)) return;
    if(element.dataset.motionCounting === "true") return;
    const parts = numberParts(element);
    if(!parts || element.dataset.motionValue === String(parts.value)) return;
    element.dataset.motionValue = String(parts.value);
    element.dataset.motionCounting = "true";
    const state = {value:0};
    gsap.to(state, {
      value:parts.value,
      duration:.9,
      ease:"power2.out",
      overwrite:true,
      onUpdate(){
        const value = parts.decimals
          ? state.value.toFixed(parts.decimals)
          : Math.round(state.value).toLocaleString("zh-TW");
        element.textContent = `${parts.prefix}${value}${parts.suffix}`;
      },
      onComplete(){ delete element.dataset.motionCounting; }
    });
  }

  function animateNumbers(scope=document){
    numberTargets.forEach(id => animateNumber(scope.querySelector(`#${id}`)));
  }

  function revealDynamic(scope=document){
    const cards = visibleElements(".speciesCard, .resultItem, .record, .summaryPanel", scope).slice(0,16);
    if(cards.length){
      gsap.from(cards, {
        autoAlpha:0,
        y:14,
        duration:.42,
        stagger:.035,
        ease:"power2.out",
        clearProps:"opacity,visibility,transform"
      });
    }
    animateNumbers(scope);
  }

  function openModal(modal, ready){
    if(!modal){
      if(typeof ready === "function") ready();
      return;
    }
    const card = modal.querySelector(".modalCard");
    if(!card){
      if(typeof ready === "function") ready();
      return;
    }
    gsap.killTweensOf([modal,card]);
    const timeline = gsap.timeline({
      onComplete(){ if(typeof ready === "function") ready(); }
    });
    timeline.fromTo(modal,
      {autoAlpha:0},
      {autoAlpha:1, duration:.2, ease:"power1.out"}
    );
    timeline.fromTo(card,
      {autoAlpha:0, y:20, scale:.982},
      {autoAlpha:1, y:0, scale:1, duration:.38, ease:"power3.out", clearProps:"opacity,visibility,transform"},
      "<.02"
    );
  }

  function closeModal(modal, done){
    const card = modal?.querySelector(".modalCard");
    if(!card){
      if(typeof done === "function") done();
      return;
    }
    gsap.killTweensOf([modal,card]);
    const timeline = gsap.timeline({
      onComplete(){
        gsap.set([modal,card],{clearProps:"opacity,visibility,transform"});
        if(typeof done === "function") done();
      }
    });
    timeline.to(card,{autoAlpha:0,y:10,scale:.99,duration:.18,ease:"power2.in"});
    timeline.to(modal,{autoAlpha:0,duration:.14,ease:"power1.in"},"<.04");
  }

  function initScrollProgress(){
    const nav = document.querySelector(".topNav");
    if(!nav) return;
    const progress = document.createElement("span");
    progress.className = "motionProgress";
    progress.setAttribute("aria-hidden","true");
    nav.append(progress);
    const setProgress = gsap.quickSetter(progress,"scaleX");

    function update(){
      const scrollable = Math.max(1,document.documentElement.scrollHeight - window.innerHeight);
      setProgress(Math.min(1,Math.max(0,window.scrollY / scrollable)));
      nav.classList.toggle("motionScrolled",window.scrollY > 10);
    }

    if(ScrollTrigger){
      ScrollTrigger.create({
        start:0,
        end:"max",
        onUpdate(self){
          setProgress(self.progress);
          nav.classList.toggle("motionScrolled",self.scroll() > 10);
        }
      });
    }else{
      window.addEventListener("scroll",update,{passive:true});
    }
    update();
  }

  function animateHomepageMap(){
    const panel = document.querySelector(".mapPanel");
    if(!panel) return;
    const dots = panel.querySelectorAll(".treeDot");
    gsap.to(dots,{
      y:-6,
      duration:1.8,
      stagger:{each:.16,from:"random"},
      ease:"sine.inOut",
      repeat:-1,
      yoyo:true
    });
    const scanLine = panel.querySelector(".scanLine");
    if(scanLine){
      gsap.fromTo(scanLine,{yPercent:-18},{yPercent:18,duration:2.6,ease:"sine.inOut",repeat:-1,yoyo:true});
    }
  }

  function animateControl(control){
    if(!control) return;
    gsap.fromTo(control,
      {scale:.975},
      {scale:1,duration:.28,ease:"back.out(2)",clearProps:"transform",overwrite:true}
    );
  }

  function initControlFeedback(){
    document.addEventListener("click",event => {
      const control = event.target.closest("button, .navLinks a, .speciesOption");
      animateControl(control);

      if(control?.matches("[data-mode]")){
        requestAnimationFrame(() => {
          const panel = document.querySelector(".searchPanel.active");
          if(!panel) return;
          gsap.fromTo(panel,{autoAlpha:0,y:8},{autoAlpha:1,y:0,duration:.3,ease:"power2.out",clearProps:"opacity,visibility,transform"});
        });
      }

      if(control?.matches("[data-view], .speciesOption")){
        requestAnimationFrame(() => revealDynamic(document));
      }
    });

    document.addEventListener("change",event => {
      if(!event.target.matches("select, input[type='checkbox']")) return;
      gsap.fromTo(event.target,{scale:.985},{scale:1,duration:.28,ease:"power2.out",clearProps:"transform"});
      requestAnimationFrame(() => revealDynamic(document));
    });
  }

  function watchDynamicContent(){
    const observer = new MutationObserver(mutations => {
      let shouldReveal = false;
      const changedNumbers = new Set();
      mutations.forEach(mutation => {
        if(mutation.type === "childList" && mutation.addedNodes.length) shouldReveal = true;
        const target = mutation.target.nodeType === Node.TEXT_NODE ? mutation.target.parentElement : mutation.target;
        if(target?.id && numberTargets.has(target.id) && target.dataset.motionCounting !== "true") changedNumbers.add(target);
      });
      if(shouldReveal) requestAnimationFrame(() => revealDynamic(document));
      changedNumbers.forEach(animateNumber);
    });
    observer.observe(document.body,{subtree:true,childList:true,characterData:true});
  }

  function init(){
    watchDynamicContent();
    initScrollProgress();
    initControlFeedback();
    window.setTimeout(() => {
      revealPage();
      animateNumbers();
      animateHomepageMap();
      ScrollTrigger?.refresh();
    }, 460);
    window.addEventListener("load", () => ScrollTrigger?.refresh(), {once:true});
  }

  window.TPTreesMotion = {openModal,closeModal,trapModalFocus,revealDynamic,animateNumber};
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();
