// Global API Xavfsiz Sozlamalari
let GITHUB_TOKEN = localStorage.getItem('token') || '';
let GITHUB_USER = localStorage.getItem('user') || '';
let uploadedFileBase64 = "";

const logPanel = document.getElementById('log-panel');

function showLog(msg, type = 'info') {
    logPanel.innerHTML = msg;
    logPanel.className = `log-panel log-${type}`;
    logPanel.classList.remove('hidden');
}

// TAB NAVIGATSIYA LOGIKASI (YANGI QO'SHILDI)
const menuItems = document.querySelectorAll('.menu-item');
const contentPanels = document.querySelectorAll('.content-panel');

menuItems.forEach(item => {
    item.addEventListener('click', () => {
        // Faol menyu klassini yangilash
        menuItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        // O'ng tarafdagi mos qatlamni ochish
        const targetId = item.getAttribute('data-target');
        contentPanels.forEach(panel => {
            if(panel.id === targetId) {
                panel.classList.remove('hidden');
            } else {
                panel.classList.add('hidden');
            }
        });
        // Har gal panel o'zgarganda eski bildirishnomalarni berkitish
        logPanel.classList.add('hidden');
    });
});

// 1. TOKENNI ULASH
document.getElementById('connect-btn').addEventListener('click', async () => {
    const inputToken = document.getElementById('token-input').value.trim();
    if(!inputToken) return alert("Tokenni kiriting");
    showLog("GitHub hisobiga ulanmoqda...", "info");
    try {
        const res = await fetch('https://api.github.com/user', {
            headers: { 'Authorization': `Bearer ${inputToken}`, 'Accept': 'application/vnd.github+json' }
        });
        if(res.ok) {
            const data = await res.json();
            GITHUB_TOKEN = inputToken;
            GITHUB_USER = data.login;
            localStorage.setItem('token', inputToken);
            localStorage.setItem('user', data.login);
            showLog(`Muvaffaqiyatli ulandi: @${GITHUB_USER}`, "success");
        } else { throw new Error("Token noto'g'ri."); }
    } catch (err) { showLog("Ulanishda xatolik: " + err.message, "error"); }
});



// 2. YANGI REPO YARATISH (Toza nom bilan ochish)
document.getElementById('create-repo-btn').addEventListener('click', async () => {
    let name = document.getElementById('new-repo-name').value.trim();
    const desc = document.getElementById('new-repo-desc').value.trim();
    if(!GITHUB_TOKEN) return alert("Avval 1-bosqichda tokenni ulang");
    if(!name) return alert("Repozitoriy nomini yozing");
    
    // Nomdagi bo'shliqlarni chiziqchaga almashtirish va harflarni kichik qilish
    name = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');

    showLog(`Yangi repo yaratilmoqda: <strong>${name}</strong>...`, "info");
    try {
        const res = await fetch('https://api.github.com/user/repos', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github+json' },
            body: JSON.stringify({ name: name, description: desc, private: false, auto_init: true })
        });
        const data = await res.json();
        if(res.ok) {
            showLog(`Muvaffaqiyatli yaratildi! <br> Havola: <a href="${data.html_url}" target="_blank">${data.name}</a>`, "success");
            document.getElementById('target-repo').value = data.name;
        } else { 
            // Agar bunday nomli repo bo'lsa, aniq xatolikni ko'rsatadi
            throw new Error(data.message === "Repository creation failed." ? "Bu nomli repozitoriy profilingizda allaqachon bor!" : data.message); 
        }
    } catch (err) { showLog("Xatolik: " + err.message, "error"); }
});



// 3. FAYL TANLASH
document.getElementById('file-picker').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if(!file) return;
    document.getElementById('file-name-display').innerText = file.name;
    document.getElementById('github-path').value = file.name;
    const reader = new FileReader();
    reader.onload = function(evt) {
        const bytes = new Uint8Array(evt.target.result);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        uploadedFileBase64 = btoa(binary);
        if(file.size < 100000) { 
            const textReader = new FileReader();
            textReader.onload = t => document.getElementById('file-preview').value = t.target.result;
            textReader.readAsText(file);
        }
    };
    reader.readAsArrayBuffer(file);
});

// 4. FAYLNI YUKLASH (COMMIT)
document.getElementById('upload-btn').addEventListener('click', async () => {
    const repo = document.getElementById('target-repo').value.trim();
    const path = document.getElementById('github-path').value.trim();
    const content = document.getElementById('file-preview').value;
    if(!GITHUB_TOKEN || !repo || !path) return alert("Iltimos, barcha maydonlarni to'ldiring");
    showLog("Fayl GitHub-ga yuklanmoqda...", "info");
    try {
        let b64 = uploadedFileBase64;
        if(!b64 && content) b64 = btoa(unescape(encodeURIComponent(content)));
        const url = `https://api.github.com/repos/${GITHUB_USER}/${repo}/contents/${path}`;
        let sha = null;
        const check = await fetch(url, { headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}` } });
        if(check.ok) { const checkData = await check.json(); sha = checkData.sha; }
        const res = await fetch(url, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github+json' },
            body: JSON.stringify({ message: "Veb-ilova orqali yuklandi", content: b64, sha: sha })
        });
        if(res.ok) {
            showLog("Fayl muvaffaqiyatli yuklandi!", "success");
            document.getElementById('file-picker').value = "";
            uploadedFileBase64 = "";
            document.getElementById('file-name-display').innerText = "Fayl tanlanmagan";
        } else { const errData = await res.json(); throw new Error(errData.message); }
    } catch (err) { showLog("Yuklashda xato: " + err.message, "error"); }
});

// 5. REYTING TIYTIMI VA INTEGRATSIYA
document.getElementById('search-user-btn').addEventListener('click', async () => {
    const user = document.getElementById('search-username').value.trim();
    if(!user) return alert("Username kiriting");

    showLog("GitHub ma'lumotlari tahlil qilinmoqda...", "info");
    const ratingResult = document.getElementById('rating-result');
    ratingResult.classList.add('hidden');

    try {
        const headers = GITHUB_TOKEN ? { 'Authorization': `Bearer ${GITHUB_TOKEN}` } : {};
        const res = await fetch(`https://api.github.com/users/${user}`, { headers });
        if(!res.ok) throw new Error("Foydalanuvchi topilmadi!");
        
        const data = await res.json();
        
        document.getElementById('res-avatar').src = data.avatar_url;
        document.getElementById('res-name').innerText = data.name || data.login;
        document.getElementById('res-repos').innerText = data.public_repos;
        document.getElementById('res-followers').innerText = data.followers;

        const score = (data.public_repos * 2) + (data.followers * 5);
        let rank = "Boshlovchi 🥚";
        if (score > 500) rank = "Afsona 🔥";
        else if (score > 200) rank = "Professional 🚀";
        else if (score > 70) rank = "Tajribali 💻";
        else if (score > 20) rank = "Faol ⚡";

        document.getElementById('res-rank').innerText = rank;

        const targetUrl = `https://www.ratemygithub.com/?username=${user}`;
        document.getElementById('manual-link').href = targetUrl;
        
        window.open(targetUrl, '_blank');
        logPanel.classList.add('hidden');
        ratingResult.classList.remove('hidden');
    } catch (err) { showLog("Xato: " + err.message, "error"); }
});

// Avtomatik tekshiruv
if (GITHUB_TOKEN && GITHUB_USER) {
    document.getElementById('token-input').value = '••••••••••••••••••••••••••••••••';
    showLog(`Avtomatik ulandi: @${GITHUB_USER}`, "success");
}
