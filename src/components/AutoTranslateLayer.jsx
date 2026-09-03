import React, { useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { translateIdToEn, containsIndonesian } from '../i18n/autoTranslate';

// Lapisan terjemahan DOM: saat bahasa = English, seluruh teks UI yang belum
// memakai t() diterjemahkan otomatis id→en (label, tombol, placeholder, dll).
// Aman terhadap re-render React: observer + penanda mutasi milik sendiri.

const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'KBD', 'SAMP', 'TEXTAREA', 'NOSCRIPT', 'IFRAME', 'CANVAS', 'SVG']);

function isSkippedElement(el) {
  return (
    !el ||
    SKIP_TAGS.has(el.nodeName) ||
    el.isContentEditable ||
    el.hasAttribute?.('data-noi18n') ||
    !!el.closest?.('[data-noi18n]')
  );
}

export default function AutoTranslateLayer() {
  const { language } = useLanguage();
  const langRef = useRef(language);
  useEffect(() => { langRef.current = language; }, [language]);

  const origText = useRef(new WeakMap()); // Text -> teks asli (id)
  const origAttr = useRef(new WeakMap()); // Element -> { attr: asli }
  const textNodes = useRef(new Set());    // daftar Text yang pernah diterjemahkan
  const attrEls = useRef(new Set());
  const oursText = useRef(new Set());     // Text yang baru kita ubah (hindari reproses)
  const oursAttr = useRef(new WeakMap()); // Element -> Set(attr) yang baru kita ubah
  const rafId = useRef(0);

  const translateTextNode = (node) => {
    try {
      const current = node.nodeValue || '';
      if (!current.trim() || !containsIndonesian(current)) return;
      if (!origText.current.has(node)) origText.current.set(node, current);
      const en = translateIdToEn(origText.current.get(node));
      if (en && en !== node.nodeValue) {
        node.nodeValue = en;
        oursText.current.add(node);
        textNodes.current.add(node);
      }
    } catch { /* node mungkin sudah terlepas */ }
  };

  const translateAttrs = (el) => {
    if (isSkippedElement(el)) return;
    for (const attr of ATTRS) {
      if (!el.hasAttribute(attr)) continue;
      const cur = el.getAttribute(attr);
      if (!cur || !containsIndonesian(cur)) continue;
      if (!origAttr.current.has(el)) origAttr.current.set(el, {});
      const store = origAttr.current.get(el);
      if (!(attr in store)) store[attr] = cur;
      const en = translateIdToEn(store[attr]);
      if (en && en !== cur) {
        el.setAttribute(attr, en);
        if (!oursAttr.current.has(el)) oursAttr.current.set(el, new Set());
        oursAttr.current.get(el).add(attr);
        attrEls.current.add(el);
      }
    }
  };

  const translateSubtreeText = (root) => {
    if (isSkippedElement(root)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        const parent = n.parentElement;
        if (!parent || isSkippedElement(parent)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n;
    while ((n = walker.nextNode())) translateTextNode(n);
  };

  const fullTranslate = () => {
    if (!document.body) return;
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        const parent = n.parentElement;
        if (!parent || isSkippedElement(parent)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let tn;
    while ((tn = tw.nextNode())) translateTextNode(tn);

    const ew = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (n) => (isSkippedElement(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    let en;
    while ((en = ew.nextNode())) translateAttrs(en);
  };

  const restoreAll = () => {
    textNodes.current.forEach((n) => {
      try {
        const orig = origText.current.get(n);
        if (orig != null && n.nodeValue !== orig) n.nodeValue = orig;
      } catch { /* node terlepas */ }
    });
    attrEls.current.forEach((el) => {
      try {
        const store = origAttr.current.get(el);
        if (!store) return;
        for (const attr of Object.keys(store)) el.setAttribute(attr, store[attr]);
      } catch { /* elemen terlepas */ }
    });
    textNodes.current.clear();
    attrEls.current.clear();
    oursText.current.clear();
    oursAttr.current = new WeakMap();
    origText.current = new WeakMap();
    origAttr.current = new WeakMap();
  };

  useEffect(() => {
    if (language !== 'en') {
      restoreAll();
      return;
    }
    fullTranslate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  useEffect(() => {
    const onMutations = (mutations) => {
      if (langRef.current !== 'en') return;
      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        rafId.current = 0;
        for (const m of mutations) {
          if (m.type === 'characterData') {
            const t = m.target;
            if (t && t.nodeType === Node.TEXT_NODE) {
              if (oursText.current.delete(t)) continue; // tulis kami sendiri
              if (!t.parentElement || isSkippedElement(t.parentElement)) continue;
              // React menimpa isi → teks terbaru menjadi sumber asli
              origText.current.delete(t);
              translateTextNode(t);
            }
          } else if (m.type === 'attributes') {
            const el = m.target;
            const set = el && oursAttr.current.get(el);
            if (set && m.attributeName && set.delete(m.attributeName)) continue;
            translateAttrs(el);
          } else if (m.type === 'childList') {
            for (const added of m.addedNodes) {
              if (added.nodeType === Node.TEXT_NODE) {
                const parent = added.parentElement;
                if (parent && !isSkippedElement(parent)) translateTextNode(added);
              } else if (added.nodeType === Node.ELEMENT_NODE) {
                translateAttrs(added);
                translateSubtreeText(added);
              }
            }
          }
        }
      });
    };

    const observer = new MutationObserver(onMutations);
    if (document.body) {
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ATTRS,
      });
    }
    return () => {
      observer.disconnect();
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
