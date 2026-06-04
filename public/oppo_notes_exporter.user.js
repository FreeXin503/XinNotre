// ==UserScript==
// @name         OPPO 云便签完美批量导出工具 (v3.2 终极强悍版)
// @namespace    http://tampermonkey.net/
// @version      3.2
// @description  终极特化版：超强深度递归启发式网络拦截器，完美识别各种驼峰与蛇形命名，一键捕捉 1600+ 全量便签，完美避开虚拟列表和浏览器假死！
// @author       Xin's Software Dev All-Stars
// @match        *://cloud.oppo.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // ==================== 状态管理 ====================
    let capturedNotesMap = new Map();
    let autoScrollInterval = null;
    let isRunning = false;
    let isPaused = false;
    let debugLogs = [];
    let interceptedResponseCount = 0;
    let rawTrafficLog = []; // 记录所有原始网络流量

    // ==================== 调试日志系统 ====================
    function debugLog(msg, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const entry = `[${timestamp}] ${msg}`;
        debugLogs.push(entry);
        if (debugLogs.length > 200) debugLogs.shift();

        const logEl = document.getElementById('debug-log-content');
        if (logEl) {
            logEl.textContent = debugLogs.slice(-30).join('\n');
            logEl.scrollTop = logEl.scrollHeight;
        }

        if (level === 'error') {
            console.error(`[OPPO Exporter] ${msg}`);
        } else {
            console.log(`[OPPO Exporter] ${msg}`);
        }
    }

    // ==================== 1. 精准的字段模式与特征侦测引擎 ====================

    // 判断一个对象是否符合“便签对象”的特征（大小写不敏感，完美适配 camelCase & snake_case）
    function isNoteLikeObject(obj) {
        if (!obj || typeof obj !== 'object') return false;

        const keys = Object.keys(obj);
        if (keys.length < 2) return false;

        // 将所有键转为小写，以便进行无视大小写和下划线的对比
        const lowerKeys = keys.map(k => k.toLowerCase().replace(/_/g, ''));

        // ID 类字段判定
        const hasId = lowerKeys.some(k => 
            k === 'id' || k === 'noteid' || k === 'guid' || k === 'uuid' || 
            k === 'syncid' || k === 'itemid' || k === 'nid' || k === 'key'
        );

        // 内容或标题类字段判定
        const hasContent = lowerKeys.some(k => 
            k === 'title' || k === 'notetitle' || k === 'subject' || k === 'heading' ||
            k === 'content' || k === 'notecontent' || k === 'body' || k === 'notebody' || 
            k === 'text' || k === 'html' || k === 'htmlcontent' || k === 'richtext' ||
            k === 'plaintext' || k === 'contenttext'
        );

        // 如果既有 ID 特征，又有内容/标题特征，则极大概率是便签对象！
        if (hasId && hasContent) return true;

        // 策略2: 如果没有匹配上 ID，但有多个明显的文本字段 (例如一个长内容 + 一个短标题)
        let longStringCount = 0;
        for (const key of keys) {
            const val = obj[key];
            if (typeof val === 'string' && val.length > 15) {
                longStringCount++;
            }
        }
        if (longStringCount >= 2) return true;

        return false;
    }

    // 智能字段映射器：将任意结构的便签对象映射为标准输出格式
    function autoMapNoteFields(item) {
        const keys = Object.keys(item);
        let mapped = {
            id: '',
            title: '',
            content: '',
            htmlContent: '',
            time: '',
            category: '全部笔记',
            rawKeys: keys.join(','),
            rawData: JSON.stringify(item).substring(0, 500)
        };

        // 1. ID 匹配
        const idCandidates = ['noteId', 'note_id', 'id', 'guid', 'uuid', 'key', 'nid', 'syncId', 'sync_id', '_id'];
        for (const c of idCandidates) {
            if (item[c] !== undefined && item[c] !== null && item[c] !== '') {
                mapped.id = String(item[c]);
                break;
            }
        }
        if (!mapped.id) mapped.id = Math.random().toString(36).substring(2, 12);

        // 2. 标题匹配
        const titleCandidates = ['title', 'noteTitle', 'note_title', 'name', 'subject', 'heading'];
        for (const c of titleCandidates) {
            if (item[c] && typeof item[c] === 'string') {
                mapped.title = item[c].trim();
                break;
            }
        }

        // 3. 内容匹配
        const contentCandidates = ['content', 'noteContent', 'note_content', 'body', 'noteBody', 'note_body', 
            'text', 'detail', 'summary', 'desc', 'description', 'plainText', 'plain_text', 
            'contentText', 'content_text', 'textContent', 'text_content', 'rawContent'];
        for (const c of contentCandidates) {
            if (item[c] && typeof item[c] === 'string' && item[c].length > 0) {
                mapped.content = item[c].trim();
                break;
            }
        }

        // 4. HTML 内容匹配
        const htmlCandidates = ['htmlContent', 'html_content', 'html', 'richText', 'rich_text', 'htmlBody', 'htmlText'];
        for (const c of htmlCandidates) {
            if (item[c] && typeof item[c] === 'string') {
                mapped.htmlContent = item[c].trim();
                break;
            }
        }

        // 如果没有 content 但有 htmlContent，则从 HTML 提取文本
        if (!mapped.content && mapped.htmlContent) {
            const tmp = document.createElement('div');
            tmp.innerHTML = mapped.htmlContent;
            mapped.content = tmp.textContent || tmp.innerText || '';
        }

        // 如果 content 依然是空，则把对象中“最长”的字符串字段作为内容
        if (!mapped.content) {
            let longestStr = '';
            for (const key of keys) {
                if (typeof item[key] === 'string' && item[key].length > longestStr.length) {
                    longestStr = item[key];
                }
            }
            if (longestStr.length > 5) {
                mapped.content = longestStr;
            }
        }

        // 如果 title 依然是空，从 content 中截取首行作为 title
        if (!mapped.title && mapped.content) {
            mapped.title = mapped.content.split('\n')[0].substring(0, 50).trim() || '未命名便签';
        }

        // 5. 更新时间匹配
        const timeCandidates = ['updateTime', 'update_time', 'modifyTime', 'modify_time', 
            'updatedAt', 'modifiedAt', 'modified', 'updated', 
            'createTime', 'create_time', 'createdAt', 'created', 
            'date', 'time', 'timestamp'];
        for (const c of timeCandidates) {
            if (item[c] !== undefined && item[c] !== null && item[c] !== '') {
                let t = item[c];
                if (typeof t === 'number') {
                    if (t > 1000000000000) { // 毫秒级时间戳
                        t = new Date(t).toLocaleString();
                    } else if (t > 100000000) { // 秒级时间戳
                        t = new Date(t * 1000).toLocaleString();
                    }
                }
                mapped.time = String(t);
                break;
            }
        }

        // 6. 分类匹配
        const catCandidates = ['tag', 'tagName', 'tag_name', 'category', 'folder', 'folderName', 'folder_name', 'label', 'group'];
        for (const c of catCandidates) {
            if (item[c] && typeof item[c] === 'string') {
                mapped.category = item[c].trim();
                break;
            }
        }

        return mapped;
    }

    // 🌟 2. 深度递归极速数据提取引擎 (Ultra-Aggressive Deep Scraper)
    // 递归扫描整个 JSON 数据树，只要发现符合便签特征的对象，不论藏多深、有无数组包装，统统直接捕获！
    function extractNotesUltraAggressively(obj, path = 'root', depth = 0) {
        if (!obj || typeof obj !== 'object' || depth > 15) return [];

        let results = [];

        // 检查当前对象是否符合便签特征
        if (isNoteLikeObject(obj)) {
            results.push(autoMapNoteFields(obj));
        }

        // 深度递归子树
        if (Array.isArray(obj)) {
            for (let i = 0; i < obj.length; i++) {
                results = results.concat(extractNotesUltraAggressively(obj[i], `${path}[${i}]`, depth + 1));
            }
        } else {
            for (let key in obj) {
                if (obj.hasOwnProperty(key) && obj[key] && typeof obj[key] === 'object') {
                    results = results.concat(extractNotesUltraAggressively(obj[key], `${path}.${key}`, depth + 1));
                }
            }
        }

        return results;
    }

    // 🌟 3. JSON 响应结构分析器 (Schema Tracer)
    // 自动在控制台打印响应的树状结构，方便一秒看出接口的具体字段
    function logObjectStructure(obj, prefix = 'root', depth = 0) {
        if (depth > 3) return;
        if (!obj) {
            debugLog(`   ${prefix}: null/undefined`);
            return;
        }
        if (typeof obj !== 'object') {
            debugLog(`   ${prefix}: ${typeof obj} (示例值: ${String(obj).substring(0, 80)})`);
            return;
        }

        if (Array.isArray(obj)) {
            debugLog(`   ${prefix}: Array(长度=${obj.length})`);
            if (obj.length > 0) {
                logObjectStructure(obj[0], `${prefix}[0]`, depth + 1);
            }
        } else {
            const keys = Object.keys(obj);
            debugLog(`   ${prefix}: Object(包含键=[${keys.slice(0, 10).join(', ')}${keys.length > 10 ? '...' : ''}])`);
            for (let key of keys.slice(0, 4)) {
                logObjectStructure(obj[key], `${prefix}.${key}`, depth + 1);
            }
        }
    }

    // ==================== 4. 处理拦截到的 API 响应 ====================
    function processApiResponse(json, sourceUrl) {
        try {
            interceptedResponseCount++;

            const jsonStr = JSON.stringify(json);
            const preview = jsonStr.substring(0, 300);
            
            // 记录到流量日志
            rawTrafficLog.push({
                index: interceptedResponseCount,
                url: sourceUrl || 'unknown',
                size: jsonStr.length,
                preview: preview,
                keys: typeof json === 'object' ? Object.keys(json).join(', ') : 'N/A'
            });

            debugLog(`📡 [网络拦截] 第 ${interceptedResponseCount} 个响应 (${jsonStr.length} 字节) URL: ${(sourceUrl || '').substring(0, 85)}`);

            // 如果是便签的核心接口，打印树形结构方便我们分析
            const isNoteListApi = sourceUrl && (sourceUrl.includes('/note/v2/list') || sourceUrl.includes('/note/v'));
            if (isNoteListApi) {
                debugLog(`🎯 侦测到关键便签列表接口！正在追踪其 JSON 结构：`);
                logObjectStructure(json, 'Response');
            }

            // 启动超强提取器
            const notes = extractNotesUltraAggressively(json);

            if (notes.length === 0) {
                debugLog(`   ❌ 此响应未通过启发式匹配，捕获到 0 条便签。`);
                return;
            }

            let newCount = 0;
            notes.forEach(note => {
                // 只有内容、标题或 HTML 内容不为空时才收录
                if (note.content || note.title || note.htmlContent) {
                    if (!capturedNotesMap.has(note.id)) {
                        capturedNotesMap.set(note.id, note);
                        newCount++;
                    }
                }
            });

            if (newCount > 0) {
                debugLog(`   ✅ 成功提取 ${newCount} 条新数据！目前累积截获：${capturedNotesMap.size} 条。`);
                updateStatus(`⚡ 网络拦截引擎成功！新拦截到 ${newCount} 条！当前已捕获 <strong>${capturedNotesMap.size}</strong> 条便签。`);
                updateProgress(capturedNotesMap.size);
            }
        } catch (err) {
            debugLog(`❌ 解析 API 数据出错: ${err.message}`, 'error');
        }
    }

    // ==================== 5. 双通道网络拦截层 (XHR + Fetch) ====================
    const interceptNetwork = () => {
        try {
            // A. 拦截 XHR
            const originalOpen = XMLHttpRequest.prototype.open;
            const originalSend = XMLHttpRequest.prototype.send;

            XMLHttpRequest.prototype.open = function(method, url) {
                this._interceptUrl = url;
                return originalOpen.apply(this, arguments);
            };

            XMLHttpRequest.prototype.send = function() {
                this.addEventListener('load', function() {
                    try {
                        if (this.responseText && this.responseText.length > 10) {
                            try {
                                const response = JSON.parse(this.responseText);
                                processApiResponse(response, this._interceptUrl);
                            } catch (parseErr) {
                                // 尝试 Base64 自动解密，防止云端数据加壳
                                if (this.responseText.length > 100) {
                                    try {
                                        const decoded = atob(this.responseText);
                                        const decodedJson = JSON.parse(decoded);
                                        debugLog(`   🔓 Base64 密文拦截解码成功！`);
                                        processApiResponse(decodedJson, this._interceptUrl + ' [Base64解码]');
                                    } catch(e) {}
                                }
                            }
                        }
                    } catch (e) {}
                });
                return originalSend.apply(this, arguments);
            };

            // B. 拦截 Fetch
            const originalFetch = window.fetch;
            window.fetch = async function(...args) {
                const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || 'unknown');
                const response = await originalFetch.apply(this, args);
                const clone = response.clone();

                try {
                    const text = await clone.text();
                    if (text && text.length > 10) {
                        try {
                            const data = JSON.parse(text);
                            processApiResponse(data, url);
                        } catch (parseErr) {
                            if (text.length > 100) {
                                try {
                                    const decoded = atob(text);
                                    const decodedJson = JSON.parse(decoded);
                                    debugLog(`   🔓 Base64 密文拦截解码成功！`);
                                    processApiResponse(decodedJson, url + ' [Base64解码]');
                                } catch(e) {}
                            }
                        }
                    }
                } catch (e) {}

                return response;
            };

            debugLog('🔧 双通道拦截底层装载成功。(XHR + Fetch)');
        } catch (err) {
            debugLog(`❌ 网络拦截装载失败: ${err.message}`, 'error');
        }
    };

    interceptNetwork();

    // ==================== 6. DOM 兜底直接抓取引擎 ====================
    function scrapeNotesFromDOM() {
        debugLog('🔬 启动 DOM 直接抓取引擎...');
        let scraped = 0;

        // 策略1: 选择器匹配
        const listItemSelectors = [
            '.note-item', '.note-list-item', '.sticky-note-item',
            '.list-item', '.item-card', '.card-item',
            '[class*="note"][class*="item"]',
            '[class*="note"][class*="card"]',
            '[class*="sticky"][class*="item"]',
            '[class*="list"] > [class*="item"]',
            '[data-v-] > div[class]'
        ];

        let noteElements = [];
        for (const sel of listItemSelectors) {
            try {
                const found = document.querySelectorAll(sel);
                if (found.length > 0) {
                    debugLog(`   DOM选择器 "${sel}" 找到 ${found.length} 个元素`);
                    if (found.length > noteElements.length) {
                        noteElements = found;
                    }
                }
            } catch(e) {}
        }

        // 策略2: 通用容器扫描
        if (noteElements.length === 0) {
            debugLog('   🔍 备用方案：扫描通用列表容器...');
            const allDivs = document.querySelectorAll('div');
            let bestContainer = null;
            let maxChildren = 0;

            for (const div of allDivs) {
                const children = div.children;
                if (children.length > 5 && children.length < 5000) {
                    let sameTagCount = 0;
                    const firstTag = children[0]?.tagName;
                    for (let i = 0; i < Math.min(children.length, 10); i++) {
                        if (children[i]?.tagName === firstTag) sameTagCount++;
                    }
                    if (sameTagCount >= Math.min(children.length, 10) * 0.8 && children.length > maxChildren) {
                        maxChildren = children.length;
                        bestContainer = div;
                    }
                }
            }

            if (bestContainer) {
                noteElements = bestContainer.children;
                debugLog(`   🎯 发现通用列表容器，子元素数: ${noteElements.length}`);
            }
        }

        if (noteElements.length === 0) {
            debugLog('   ❌ DOM 中未发现任何便签列表元素');
            return 0;
        }

        for (const el of noteElements) {
            try {
                const textContent = el.textContent?.trim();
                if (!textContent || textContent.length < 2) continue;

                let title = '';
                const titleEl = el.querySelector('h1, h2, h3, h4, h5, .title, [class*="title"], [class*="name"], strong, b');
                if (titleEl) {
                    title = titleEl.textContent?.trim() || '';
                }

                let content = textContent;
                if (title && content.startsWith(title)) {
                    content = content.substring(title.length).trim();
                }

                let time = '';
                const timeEl = el.querySelector('[class*="time"], [class*="date"], time, [class*="meta"]');
                if (timeEl) {
                    time = timeEl.textContent?.trim() || '';
                }

                if (!title) {
                    title = content.substring(0, 50).replace(/[\n\r]/g, ' ');
                }

                const id = 'dom_' + btoa(unescape(encodeURIComponent((title + content).substring(0, 100)))).substring(0, 20);

                if (!capturedNotesMap.has(id) && content.length > 0) {
                    capturedNotesMap.set(id, {
                        id: id,
                        title: title,
                        content: content,
                        htmlContent: el.innerHTML,
                        time: time,
                        category: '全部笔记(DOM抓取)',
                        rawKeys: 'DOM',
                        rawData: ''
                    });
                    scraped++;
                }
            } catch(e) {
                debugLog(`   ⚠️ 解析 DOM 元素出错: ${e.message}`);
            }
        }

        debugLog(`🔬 DOM 抓取引擎完成：提取 ${scraped} 条便签`);
        return scraped;
    }

    // ==================== 7. 点击遍历强抓引擎 ====================
    async function clickAndScrapeNotes() {
        debugLog('🖱️ 启动点击遍历强抓引擎...');

        const listItemSelectors = [
            '.note-item', '.note-list-item',
            '[class*="note"][class*="item"]',
            '[class*="list"] [class*="item"]',
            '[class*="sticky"] [class*="item"]'
        ];

        let clickableItems = [];
        for (const sel of listItemSelectors) {
            try {
                const found = document.querySelectorAll(sel);
                if (found.length > clickableItems.length) {
                    clickableItems = Array.from(found);
                }
            } catch(e) {}
        }

        if (clickableItems.length === 0) {
            const allLists = document.querySelectorAll('[class*="list"]');
            for (const list of allLists) {
                if (list.children.length > 3) {
                    clickableItems = Array.from(list.children);
                    break;
                }
            }
        }

        if (clickableItems.length === 0) {
            debugLog('   ❌ 页面上未发现可点击的便签列表项！');
            return 0;
        }

        debugLog(`   🎯 锁定 ${clickableItems.length} 个便签项，开始逐个模拟点击...`);
        let clickScraped = 0;

        for (let i = 0; i < clickableItems.length; i++) {
            if (!isRunning) break;

            try {
                clickableItems[i].click();
                await new Promise(r => setTimeout(r, 350)); // 等待详情区加载

                const contentSelectors = [
                    '.note-content', '.note-detail', '.note-editor',
                    '[class*="content"][class*="note"]',
                    '[class*="detail"]', '[class*="editor"]',
                    '.ql-editor', '.ProseMirror', '[contenteditable="true"]',
                    '.simplebar-content'
                ];

                let contentEl = null;
                for (const sel of contentSelectors) {
                    const el = document.querySelector(sel);
                    if (el && el.textContent?.trim().length > 3) {
                        contentEl = el;
                        break;
                    }
                }

                if (contentEl) {
                    const content = contentEl.textContent?.trim();
                    const html = contentEl.innerHTML;
                    const title = content.split('\n')[0].substring(0, 50).trim() || '未命名便签';
                    const id = 'click_' + i + '_' + btoa(unescape(encodeURIComponent(title))).substring(0, 12);

                    if (!capturedNotesMap.has(id) && content.length > 0) {
                        capturedNotesMap.set(id, {
                            id: id,
                            title: title,
                            content: content,
                            htmlContent: html,
                            time: '',
                            category: '全部笔记(点击抓取)',
                            rawKeys: 'Click',
                            rawData: ''
                        });
                        clickScraped++;
                    }
                }

                if (i % 10 === 0) {
                    updateStatus(`🖱️ 遍历点击中: ${i+1}/${clickableItems.length}，当前已获取 <strong>${capturedNotesMap.size}</strong> 条`);
                    updateProgress(capturedNotesMap.size);
                }
            } catch(e) {
                debugLog(`   ⚠️ 点击第 ${i} 项出错: ${e.message}`);
            }
        }

        debugLog(`🖱️ 点击遍历强抓完成：获取到 ${clickScraped} 条便签`);
        return clickScraped;
    }

    // ==================== 8. 自动滚动触发引擎 ====================
    function startAutoScrollTrigger() {
        try {
            if (autoScrollInterval) return;

            updateStatus('🚀 正在启动双引擎极速拦截模式...<br>📡 网络拦截实时截获 API 数据包<br>📜 自动滑屏向服务器连续请求新页面');

            let container = document.querySelector('.simplebar-content-wrapper');

            if (!container) {
                const scrollableDivs = Array.from(document.querySelectorAll('div'));
                for (let d of scrollableDivs) {
                    const s = window.getComputedStyle(d);
                    if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && d.offsetHeight > 200 && d.scrollHeight > d.offsetHeight + 30) {
                        container = d;
                        debugLog(`🎯 成功锁定自定义滚动容器: ${d.className?.substring(0, 60)} (高度=${d.offsetHeight}, 滚动高度=${d.scrollHeight})`);
                        break;
                    }
                }
            } else {
                debugLog(`🎯 成功锁定 SimpleBar 滚动窗口`);
            }

            if (!container) {
                debugLog('⚠️ 未发现独立滚动容器，将使用 window 默认滚动窗口');
            }

            let lastScrollTop = -1;
            let samePositionCount = 0;
            let scrollTick = 0;

            autoScrollInterval = setInterval(() => {
                try {
                    if (!isRunning) {
                        clearInterval(autoScrollInterval);
                        autoScrollInterval = null;
                        return;
                    }

                    if (isPaused) return;

                    scrollTick++;

                    if (container && container !== window) {
                        container.scrollTop += 550;

                        if (container.scrollTop === lastScrollTop) {
                            samePositionCount++;
                        } else {
                            lastScrollTop = container.scrollTop;
                            samePositionCount = 0;
                        }

                        if (scrollTick % 20 === 0) {
                            debugLog(`📜 滚动中: scrollTop=${container.scrollTop}, 滞留计数=${samePositionCount}`);
                        }
                    } else {
                        window.scrollBy(0, 550);
                        const currentY = window.scrollY || document.documentElement.scrollTop || 0;

                        if (currentY === lastScrollTop) {
                            samePositionCount++;
                        } else {
                            lastScrollTop = currentY;
                            samePositionCount = 0;
                        }
                    }

                    // 实时状态反馈
                    if (scrollTick % 10 === 0) {
                        updateStatus(`🚀 双引擎数据截获中...<br>📡 网络拦截到 ${interceptedResponseCount} 个响应<br>📦 已成功截获便签: <strong>${capturedNotesMap.size}</strong> 条<br>📜 触底自动检测中 (滞留计数: ${samePositionCount}/20)`);
                    }

                    // 触底判定
                    if (samePositionCount >= 20) {
                        clearInterval(autoScrollInterval);
                        autoScrollInterval = null;

                        debugLog(`📜 滑动列表已完全触底！共拦截 ${interceptedResponseCount} 个网络响应`);

                        // 自动降级兜底：网络引擎如果 0 条，立刻启动 DOM 引擎
                        if (capturedNotesMap.size === 0) {
                            debugLog('⚠️ 网络引擎未截获有效数据，正在为您自动切换至 DOM 直接抓取引擎...');
                            updateStatus('⚠️ 网络拦截为空，正在自动降级为您启动 DOM 引擎抓取...');

                            const domCount = scrapeNotesFromDOM();

                            if (domCount === 0) {
                                updateStatus(`⚠️ DOM 抓取也未获得数据。<br>📊 网络流量分析：共成功拦截 ${interceptedResponseCount} 个响应，但启发式引擎判断并非便签列表。<br>💡 您可以点击下方的“查看网络流量诊断报告”或“点击遍历强抓”按钮！`);
                            } else {
                                updateStatus(`🎉 DOM 直接抓取大成功！成功捕获到 <strong>${capturedNotesMap.size}</strong> 条全量便签！<br>点击下方“💾 立即下载全量备份文件”即可打包！`);
                                updateProgress(capturedNotesMap.size);
                            }
                        } else {
                            updateStatus(`🎉 列表加载完毕！双引擎共拦截截获 <strong>${capturedNotesMap.size}</strong> 条全量便签！<br>点击下方“💾 立即下载全量备份文件”即可打包！`);
                            updateProgress(capturedNotesMap.size);
                        }

                        showDownloadBtn();
                    }
                } catch (scrollErr) {
                    debugLog(`❌ 自动滚动中出错: ${scrollErr.message}`, 'error');
                }
            }, 50);
        } catch (err) {
            updateStatus(`❌ 启动滚动失败: ${err.message}`);
        }
    }

    function showDownloadBtn() {
        const dlBtn = document.getElementById('btn-download');
        const diagBtn = document.getElementById('btn-diag');
        const clickBtn = document.getElementById('btn-click-scrape');
        if (dlBtn) dlBtn.style.display = 'block';
        if (diagBtn) diagBtn.style.display = 'block';
        if (clickBtn) clickBtn.style.display = 'block';
    }

    // ==================== 9. UI 控制面板注入 ====================
    const injectUI = () => {
        try {
            if (!document.body) {
                setTimeout(injectUI, 100);
                return;
            }
            if (document.getElementById('oppo-exporter-panel')) return;

            const style = document.createElement('style');
            style.textContent = `
                #oppo-exporter-panel {
                    position: fixed;
                    top: 60px;
                    right: 15px;
                    width: 400px;
                    max-height: 90vh;
                    overflow-y: auto;
                    background: rgba(15, 15, 25, 0.98);
                    backdrop-filter: blur(25px);
                    border: 1px solid rgba(6, 182, 212, 0.4);
                    border-radius: 16px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), 0 0 30px rgba(6, 182, 212, 0.15);
                    color: #e2e8f0;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    z-index: 999999;
                    font-size: 13px;
                }
                .panel-header {
                    background: linear-gradient(135deg, #06b6d4, #8b5cf6);
                    padding: 14px 18px;
                    font-weight: 800;
                    font-size: 14px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-radius: 16px 16px 0 0;
                    position: sticky;
                    top: 0;
                    z-index: 10;
                }
                .panel-body {
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .status-text {
                    font-size: 12px;
                    background: rgba(0, 0, 0, 0.5);
                    padding: 12px;
                    border-radius: 10px;
                    min-height: 50px;
                    border-left: 4px solid #06b6d4;
                    line-height: 1.6;
                }
                .progress-bar-container {
                    background: rgba(255, 255, 255, 0.08);
                    height: 6px;
                    border-radius: 3px;
                    overflow: hidden;
                }
                .progress-bar {
                    width: 0%;
                    height: 100%;
                    background: linear-gradient(90deg, #06b6d4, #8b5cf6, #ec4899);
                    transition: width 0.3s ease;
                    border-radius: 3px;
                }
                .btn-group {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .btn {
                    padding: 10px 14px;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 700;
                    font-size: 13px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    transition: all 0.2s ease;
                    text-align: center;
                }
                .btn:hover { transform: translateY(-1px); filter: brightness(1.1); }
                .btn-primary {
                    background: linear-gradient(135deg, #06b6d4, #8b5cf6);
                    color: #fff;
                    box-shadow: 0 4px 15px rgba(6, 182, 212, 0.4);
                }
                .btn-green {
                    background: linear-gradient(135deg, #22c55e, #15803d);
                    color: #fff;
                    box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4);
                }
                .btn-orange {
                    background: linear-gradient(135deg, #f97316, #ea580c);
                    color: #fff;
                }
                .btn-secondary {
                    background: rgba(255, 255, 255, 0.08);
                    color: #e2e8f0;
                    border: 1px solid rgba(255,255,255,0.1);
                }
                .btn-danger {
                    background: linear-gradient(135deg, #ef4444, #dc2626);
                    color: #fff;
                }
                .debug-panel {
                    display: none;
                    background: rgba(0, 0, 0, 0.7);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    padding: 10px;
                    max-height: 200px;
                    overflow-y: auto;
                    font-family: 'Consolas', 'Monaco', monospace;
                    font-size: 10px;
                    color: #94a3b8;
                    white-space: pre-wrap;
                    word-break: break-all;
                    line-height: 1.4;
                }
                .toggle-debug {
                    background: none;
                    border: 1px solid rgba(255,255,255,0.2);
                    color: #94a3b8;
                    border-radius: 6px;
                    padding: 6px 10px;
                    cursor: pointer;
                    font-size: 11px;
                    width: 100%;
                    text-align: center;
                }
                .toggle-debug:hover {
                    background: rgba(255,255,255,0.05);
                    color: #e2e8f0;
                }
                .diag-modal {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.85);
                    z-index: 9999999;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                .diag-content {
                    background: #12121f;
                    border: 1px solid rgba(6,182,212,0.3);
                    border-radius: 16px;
                    width: 80vw;
                    max-height: 80vh;
                    overflow-y: auto;
                    padding: 24px;
                    color: #e2e8f0;
                    font-family: 'Consolas', monospace;
                    font-size: 12px;
                }
                .diag-content h2 {
                    color: #06b6d4;
                    margin-bottom: 16px;
                }
                .diag-entry {
                    background: rgba(0,0,0,0.4);
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 10px;
                    border-left: 3px solid #8b5cf6;
                }
                .diag-entry .url { color: #06b6d4; }
                .diag-entry .preview { color: #94a3b8; word-break: break-all; }
                .diag-close {
                    position: absolute;
                    top: 20px;
                    right: 30px;
                    background: #ef4444;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: bold;
                }
            `;
            document.head.appendChild(style);

            const panel = document.createElement('div');
            panel.id = 'oppo-exporter-panel';
            panel.innerHTML = `
                <div class="panel-header">
                    <span>🚀 OPPO云便签终极导出 v3.2</span>
                    <span style="font-size:11px;opacity:0.8;">双引擎</span>
                </div>
                <div class="panel-body">
                    <div class="status-text" id="export-status">
                        ✅ 已就绪！网络拦截引擎已自动激活。<br>
                        点击下方按钮启动自动滚动，触发服务器发送全量数据包。<br>
                        <span style="color:#06b6d4;">💡 提示：如果网络拦截未能匹配，脚本将自动切换DOM抓取模式！</span>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar" id="export-progress"></div>
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-primary" id="btn-start">🚀 启动自动数据获取 (双引擎)</button>
                        <button class="btn btn-orange" id="btn-dom-scrape" style="display:none;">🔬 立即 DOM 抓取 (不滚动)</button>
                        <button class="btn btn-orange" id="btn-click-scrape" style="display:none;">🖱️ 点击遍历强抓 (逐条点击)</button>
                        <button class="btn btn-green" id="btn-download" style="display:none;">💾 立即下载全量备份文件 (JSON)</button>
                        <button class="btn btn-secondary" id="btn-diag" style="display:none;">📊 查看网络流量诊断报告</button>
                        <button class="btn btn-danger" id="btn-stop" style="display:none;">🛑 重置/取消</button>
                    </div>
                    <button class="toggle-debug" id="toggle-debug">📋 展开/收起实时调试日志</button>
                    <div class="debug-panel" id="debug-log-content"></div>
                </div>
            `;
            document.body.appendChild(panel);

            // 事件绑定
            document.getElementById('btn-start').addEventListener('click', startCapture);
            document.getElementById('btn-download').addEventListener('click', downloadJsonBackup);
            document.getElementById('btn-stop').addEventListener('click', stopCapture);
            document.getElementById('btn-dom-scrape').addEventListener('click', () => {
                const count = scrapeNotesFromDOM();
                if (count > 0) {
                    updateStatus(`🔬 DOM 直接抓取大成功！成功捕获到 <strong>${capturedNotesMap.size}</strong> 条全量便签！<br>点击下方“💾 下载”即可导出！`);
                    updateProgress(capturedNotesMap.size);
                    document.getElementById('btn-download').style.display = 'block';
                } else {
                    updateStatus('❌ DOM 引擎也未抓取到有效数据。请确保页面上已加载便签列表。');
                }
            });
            document.getElementById('btn-click-scrape').addEventListener('click', async () => {
                updateStatus('🖱️ 正在逐条模拟点击抓取，请勿操作网页...');
                const count = await clickAndScrapeNotes();
                if (count > 0) {
                    updateStatus(`🖱️ 点击遍历强抓成功！累积获取 <strong>${capturedNotesMap.size}</strong> 条便签！<br>点击“💾 下载”导出数据。`);
                    updateProgress(capturedNotesMap.size);
                    document.getElementById('btn-download').style.display = 'block';
                } else {
                    updateStatus('❌ 点击遍历强抓未获取到数据。');
                }
            });
            document.getElementById('btn-diag').addEventListener('click', showDiagnosticReport);
            document.getElementById('toggle-debug').addEventListener('click', () => {
                const logPanel = document.getElementById('debug-log-content');
                logPanel.style.display = logPanel.style.display === 'none' ? 'block' : 'none';
            });

            debugLog('✅ 控制面板注入成功');
        } catch (uiErr) {
            console.error('[OPPO Exporter] UI 注入失败:', uiErr);
        }
    };

    // ==================== 10. 网络流量诊断报告 ====================
    function showDiagnosticReport() {
        const existing = document.getElementById('diag-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'diag-modal';
        modal.className = 'diag-modal';

        let entriesHtml = '';
        if (rawTrafficLog.length === 0) {
            entriesHtml = '<p style="color:#ef4444;">⚠️ 未拦截到任何网络流量！可能的原因：<br>1. 页面使用了 WebSocket 而非 HTTP 请求<br>2. 数据在脚本装载前已经请求完成 (请刷新页面再试)<br>3. 浏览器开启了非常严格的安全隔离</p>';
        } else {
            rawTrafficLog.forEach(entry => {
                entriesHtml += `
                    <div class="diag-entry">
                        <div><strong>#${entry.index}</strong> | 大小: ${entry.size} 字节</div>
                        <div class="url">URL: ${entry.url}</div>
                        <div>顶层字段: ${entry.keys}</div>
                        <div class="preview">预览: ${entry.preview.replace(/</g, '&lt;')}</div>
                    </div>
                `;
            });
        }

        modal.innerHTML = `
            <div class="diag-content" style="position:relative;">
                <button class="diag-close" id="diag-close-btn">✕ 关闭</button>
                <h2>📊 网络流量诊断报告</h2>
                <p>共拦截到 <strong>${rawTrafficLog.length}</strong> 个 HTTP 响应 | 已成功截获便签: <strong>${capturedNotesMap.size}</strong> 条</p>
                <hr style="border-color:rgba(255,255,255,0.1);margin:12px 0;">
                ${entriesHtml}
                <hr style="border-color:rgba(255,255,255,0.1);margin:12px 0;">
                <h3>📋 完整调试日志</h3>
                <pre style="color:#94a3b8;font-size:10px;max-height:250px;overflow-y:auto;background:rgba(0,0,0,0.5);padding:12px;border-radius:8px;">${debugLogs.join('\n')}</pre>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('diag-close-btn').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    }

    // ==================== 状态更新 ====================
    const updateStatus = (text) => {
        try {
            const el = document.getElementById('export-status');
            if (el) el.innerHTML = text;
        } catch(e) {}
    };

    const updateProgress = (count) => {
        try {
            const el = document.getElementById('export-progress');
            let total = 1653;
            const countBadge = document.querySelector('[class*="count"], [class*="total"], [class*="项"]');
            if (countBadge) {
                const matchedNum = countBadge.innerText.replace(/,/g, '').match(/\d+/);
                if (matchedNum) total = parseInt(matchedNum[0]);
            }
            const percent = total > 0 ? (count / total) * 100 : 0;
            if (el) el.style.width = `${Math.min(100, percent)}%`;
        } catch(e) {}
    };

    // ==================== 启动捕获 ====================
    function startCapture() {
        try {
            isRunning = true;
            capturedNotesMap.clear();
            interceptedResponseCount = 0;
            rawTrafficLog = [];
            debugLogs = [];

            document.getElementById('btn-start').style.display = 'none';
            document.getElementById('btn-dom-scrape').style.display = 'block';
            document.getElementById('btn-stop').style.display = 'block';

            debugLog('🚀 双引擎极速获取已经启动！');

            // 启动滑屏以触发 AJAX 请求
            startAutoScrollTrigger();
        } catch (err) {
            updateStatus(`❌ 启动失败: ${err.message}`);
        }
    }

    // ==================== 下载备份 ====================
    function downloadJsonBackup() {
        try {
            if (capturedNotesMap.size === 0) {
                alert('当前尚未捕获到数据，请滚动列表或重新启动获取！');
                return;
            }

            updateStatus('📦 正在为您生成全量 JSON 数据备份中...');

            const exportArray = Array.from(capturedNotesMap.values());
            const jsonBlob = new Blob([JSON.stringify(exportArray, null, 4)], { type: 'application/json' });
            const jsonUrl = URL.createObjectURL(jsonBlob);

            const a = document.createElement('a');
            a.href = jsonUrl;
            a.download = `oppo_notes_export_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(jsonUrl);

            updateStatus(`🏆 数据完美导出！成功打包 <strong>${exportArray.length}</strong> 条全量便签！<br>请立即双击项目目录中的 <b>preview.html</b>，拖入此 JSON 文件享受极速本地浏览与 150ms 批量打包 Markdown/ZIP！`);
        } catch (err) {
            updateStatus(`❌ 导出失败: ${err.message}`);
        }
    }

    // ==================== 重置取消 ====================
    function stopCapture() {
        try {
            isRunning = false;
            if (autoScrollInterval) {
                clearInterval(autoScrollInterval);
                autoScrollInterval = null;
            }
            capturedNotesMap.clear();
            interceptedResponseCount = 0;
            rawTrafficLog = [];
            debugLogs = [];

            updateStatus('🛑 拦截已重置。您可以重新启动获取！');

            document.getElementById('btn-start').style.display = 'block';
            document.getElementById('btn-download').style.display = 'none';
            document.getElementById('btn-dom-scrape').style.display = 'none';
            document.getElementById('btn-click-scrape').style.display = 'none';
            document.getElementById('btn-diag').style.display = 'none';
            document.getElementById('btn-stop').style.display = 'none';
            updateProgress(0);
        } catch(e) {}
    }

    // ==================== 初始化 ====================
    const init = () => {
        const checkTimer = setInterval(() => {
            if (document.body) {
                clearInterval(checkTimer);
                injectUI();
            }
        }, 300);
    };

    init();
})();
