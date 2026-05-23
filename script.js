// Global o'zgaruvchilar
let GITHUB_TOKEN = localStorage.getItem('token') || '';
let GITHUB_USER = localStorage.getItem('user') || '';
let uploadedFileBase64 = "";

const logPanel = document.getElementById('log-panel');

// Yordamchi: Bildirishnomalarni ko'rsatish
function showLog(msg, type = 'info') {
    logPanel.innerHTML = msg;
    logPanel.className = `log-panel log-${type}`;
    logPanel.classList.remove('hidden');
}

// 1. TOKENNI ULASH
document.getElementById('connect-btn').addEventListener('click', async () => {
    const inputToken = document.getElementById('token-input').value.trim();
    if(!inputToken) return alert("Tokenni kiriting");

    showLog("GitHub hisobiga ulanmoqda...", "info");

    try {
        const res = await fetch('https://api.github.com/user', {
            headers: { 
                'Authorization': `Bearer ${inputToken}`,
                'Accept': 'application/vnd.github+json'
            }
        });
        if(res.ok) {
            const data = await res.json();
            GITHUB_TOKEN = inputToken;
            GITHUB_USER = data.login;
            localStorage.setItem('token', inputToken);
            localStorage.setItem('user', data.login);
            showLog(`Muvaffaqiyatli ulandi: @${GITHUB_USER}`, "success");
        } else {
            throw new Error("Token noto'g'ri yoki ruxsati eskirgan.");
        }
    } catch (err) {
        showLog("Ulanishda xatolik: " + err.message, "error");
    }
});

// 2. YANGI REPO YARATISH (Takrorlanishdan himoyalangan)
document.getElementById('create-repo-btn').addEventListener('click', async () => {
    let name = document.getElementById('new-repo-name').value.trim();
    const desc = document.getElementById('new-repo-desc').value.trim();

    if(!GITHUB_TOKEN) return alert("Avval 1-bosqichda tokenni ulang");
    if(!name) return alert("Repozitoriy nomini yozing");

    // Nomdagi bo'shliqlarni chiziqchaga almashtirish va harflarni kichik qilish
    name = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');

    // Nom takrorlanmasligi uchun unga tasodifiy 4 xonali raqam qo'shish
    const randomId = Math.floor(1000 + Math.random() * 9000);
    const uniqueName = `${name}-${randomId}`;

    showLog(`Yangi repo yaratilmoqda: <strong>${uniqueName}</strong>...`, "info");

    try {
        const res = await fetch('https://api.github.com/user/repos', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github+json'
            },
            body: JSON.stringify({ 
                name: uniqueName, 
                description: desc, 
                private: false, 
                auto_init: true 
            })
        });
        
        const data = await res.json();
        
        if(res.ok) {
            showLog(`Muvaffaqiyatli yaratildi! <br> Havola: <a href="${data.html_url}" target="_blank">${data.name}</a>`, "success");
            // 3-bosqichdagi maydonga yangi unikal repo nomini avtomatik yozadi
            document.getElementById('target-repo').value = data.name;
        } else {
            throw new Error(data.message + (data.errors ? ` (${data.errors[0].message})` : ""));
        }
    } catch (err) {
        showLog("Xatolik: " + err.message, "error");
    }
});

// 3. FAYL TANLASH (KOMPYUTERDAN)
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
        if(check.ok) {
            const checkData = await check.json();
            sha = checkData.sha;
        }

        const res = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github+json'
            },
            body: JSON.stringify({
                message: "Veb-ilova orqali yuklandi",
                content: b64,
                sha: sha
            })
        });

        if(res.ok) {
            showLog("Fayl muvaffaqiyatli yuklandi!", "success");
            // Formani tozalash
            document.getElementById('file-picker').value = "";
            uploadedFileBase64 = "";
            document.getElementById('file-name-display').innerText = "Fayl tanlanmagan";
        } else {
            const errData = await res.json();
            throw new Error(errData.message);
        }
    } catch (err) {
        showLog("Yuklashda xato: " + err.message, "error");
    }
});

// Dasturni dastlabki tekshirish
if (GITHUB_TOKEN && GITHUB_USER) {
    document.getElementById('token-input').value = '••••••••••••••••••••••••••••••••';
    showLog(`Avtomatik ulandi: @${GITHUB_USER}`, "success");
}