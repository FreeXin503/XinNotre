const fs = require('fs');
const path = require('path');

const previewPath = path.join(__dirname, '../../preview.html');
console.log('Reading preview.html from:', previewPath);

if (!fs.existsSync(previewPath)) {
    console.error('preview.html does not exist!');
    process.exit(1);
}

const content = fs.readFileSync(previewPath, 'utf8');

let errors = [];
let passes = [];

function assert(condition, message) {
    if (condition) {
        passes.push(message);
        console.log('PASS:', message);
    } else {
        errors.push(message);
        console.error('FAIL:', message);
    }
}

// 1. Verify height and scrollbar prevention on body and main
const hasBodyHeight = /body\s*\{[^}]*height:\s*100vh/i.test(content);
const hasBodyOverflow = /body\s*\{[^}]*overflow:\s*hidden/i.test(content);
assert(hasBodyHeight && hasBodyOverflow, 'body should have height: 100vh and overflow: hidden to prevent global scrollbar');

const hasMainHeight = /main\s*\{[^}]*height:\s*calc\(100vh\s*-\s*56px\)/i.test(content);
const hasMainOverflow = /main\s*\{[^}]*overflow:\s*hidden/i.test(content);
assert(hasMainHeight && hasMainOverflow, 'main should have height: calc(100vh - 56px) and overflow: hidden');

// 2. Verify independent scrolls for panels
const scrollContainers = [
    'category-list',
    'drawer-content-experts',
    'notes-list',
    'dashboard-view',
    'reader-body-container',
    'ai-chat-messages-container'
];

scrollContainers.forEach(container => {
    // Check if the container class/ID is defined with overflow-y: auto/scroll in style
    const reg = new RegExp(`(\\.|#)${container}[^}]*overflow-y:\\s*(auto|scroll)`, 'i');
    const inlineReg = new RegExp(`id="${container}"[^>]*style="[^"]*overflow-y:\\s*(auto|scroll)`, 'i');
    const classInlineReg = new RegExp(`class="[^"]*${container}[^"]*"[^>]*style="[^"]*overflow-y:\\s*(auto|scroll)`, 'i');
    const ok = reg.test(content) || inlineReg.test(content) || classInlineReg.test(content) || content.includes(`id="${container}"`) && content.includes('overflow-y: auto');
    assert(ok, `Container ${container} should have independent scroll configured (overflow-y: auto/scroll)`);
});

// 3. Spacing / Gaps: 16px - 20px
const gapMatches = [...content.matchAll(/gap:\s*(\d+)px/g)].map(m => parseInt(m[1]));
const paddingMatches = [...content.matchAll(/padding:\s*(\d+)px/g)].map(m => parseInt(m[1]));
const mainGapRegex = /main\s*\{[^}]*gap:\s*(\d+)px/i;
const mainGapMatch = content.match(mainGapRegex);
if (mainGapMatch) {
    const mainGap = parseInt(mainGapMatch[1]);
    assert(mainGap >= 16 && mainGap <= 20, `main gap (${mainGap}px) should be between 16px and 20px`);
} else {
    assert(false, 'main gap property not found in CSS');
}

// 4. Panel radii: 12px - 16px
const panelRadii = [
    { name: 'icon-sidebar', regex: /\.icon-sidebar\s*\{[^}]*border-radius:\s*(\d+)px/i },
    { name: 'collapsible-drawer', regex: /\.collapsible-drawer\s*\{[^}]*border-radius:\s*(\d+)px/i },
    { name: 'notes-panel', regex: /\.notes-panel\s*\{[^}]*border-radius:\s*(\d+)px/i },
    { name: 'reader-panel', regex: /\.reader-panel\s*\{[^}]*border-radius:\s*(\d+)px/i },
    { name: 'ai-panel', regex: /\.ai-panel\.collapsible-panel\s*\{[^}]*border-radius:\s*(\d+)px/i }
];

panelRadii.forEach(panel => {
    const match = content.match(panel.regex);
    if (match) {
        const radius = parseInt(match[1]);
        assert(radius >= 12 && radius <= 16, `Panel ${panel.name} border-radius (${radius}px) should be between 12px and 16px`);
    } else {
        // Fallback check
        const fallbackRegex = new RegExp(`\\.${panel.name}[^}]*border-radius:\\s*(\\d+)px`, 'i');
        const fallbackMatch = content.match(fallbackRegex);
        if (fallbackMatch) {
            const radius = parseInt(fallbackMatch[1]);
            assert(radius >= 12 && radius <= 16, `Panel ${panel.name} border-radius (${radius}px) should be between 12px and 16px`);
        } else {
            assert(false, `Panel ${panel.name} border-radius not found in CSS`);
        }
    }
});

// 5. Drawer JS toggle logic
const hasCloseDrawerListener = content.includes('btnCloseDrawer') && content.includes('addEventListener') && content.includes('leftSidebarCollapsed = true');
const hasNavKnowledgeListener = content.includes('btnNavKnowledge') && content.includes('addEventListener');
const hasNavExpertsListener = content.includes('btnNavExperts') && content.includes('addEventListener');
const hasOutsideClickListener = content.includes('click') && content.includes('secondary-drawer') && content.includes('leftSidebarCollapsed = true');

assert(hasCloseDrawerListener, 'Should have event listener to close drawer when close button is clicked');
assert(hasNavKnowledgeListener, 'Should have event listener to toggle knowledge drawer');
assert(hasNavExpertsListener, 'Should have event listener to toggle experts drawer');
assert(hasOutsideClickListener, 'Should have event listener to close drawer when clicking outside');

// 6. Theme colors check
const hasBgBaseDark = /--bg-base:\s*#131314/i.test(content);
const hasBgSurfaceDark = /--bg-surface:\s*#1e1f20/i.test(content);
const hasBgBaseLight = /--bg-base:\s*#f7f9fc/i.test(content);
const hasBgSurfaceLight = /--bg-surface:\s*#ffffff/i.test(content);

assert(hasBgBaseDark && hasBgSurfaceDark, 'Dark theme background variables should be #131314 and #1e1f20');
assert(hasBgBaseLight && hasBgSurfaceLight, 'Light theme background variables should be #f7f9fc and #ffffff');

console.log(`\n--- Verification Summary ---`);
console.log(`Passes: ${passes.length}`);
console.log(`Failures: ${errors.length}`);

if (errors.length > 0) {
    console.error('Audit failed!');
    process.exit(1);
} else {
    console.log('Audit passed successfully!');
    process.exit(0);
}
