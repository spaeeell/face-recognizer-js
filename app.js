// ============================================================
//  FACE RECOGNIZER — ПОЛНАЯ ЛОГИКА
// ============================================================

let etalons = [];
let modelsLoaded = false;
let pendingFile = null; // временное хранение выбранного файла

const statusEl = document.getElementById('status');
const etalonInput = document.getElementById('etalonInput');
const testInput = document.getElementById('testInput');
const etalonList = document.getElementById('etalonList');
const etalonCount = document.getElementById('etalonCount');
const testPreview = document.getElementById('testPreview');
const testResult = document.getElementById('testResult');
const clearBtn = document.getElementById('clearEtalons');
const addBtn = document.getElementById('addEtalonBtn');
const recognizeBtn = document.getElementById('recognizeBtn');
const etalonPreviewArea = document.getElementById('etalonPreviewArea');
const etalonPreviewImg = document.getElementById('etalonPreviewImg');
const etalonNameInput = document.getElementById('etalonNameInput');

// ============================================================
//  1. ЗАГРУЗКА МОДЕЛЕЙ
// ============================================================
async function loadModels() {
    try {
        statusEl.textContent = '⏳ Загрузка моделей...';
        statusEl.style.borderColor = '#58a6ff';

        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@justadudewhohacks/face-api.js@0.22.2/data/models/';
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

        modelsLoaded = true;
        statusEl.textContent = '✅ Модели загружены! Можно работать.';
        statusEl.style.borderColor = '#3fb950';
        console.log('✅ Все модели загружены');
    } catch (e) {
        statusEl.textContent = '❌ Ошибка загрузки моделей. Проверь папку models.';
        statusEl.style.borderColor = '#da3633';
        console.error(e);
    }
}

// ============================================================
//  2. ПОЛУЧИТЬ ВЕКТОР ЛИЦА
// ============================================================
async function getDescriptor(img) {
    if (!modelsLoaded) throw new Error('Модели не загружены');
    const det = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
    return det ? det.descriptor : null;
}

// ============================================================
//  3. ДОБАВИТЬ ЭТАЛОН
// ============================================================
async function addEtalon(file, name) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const img = new Image();
            img.onload = async () => {
                try {
                    const desc = await getDescriptor(img);
                    if (!desc) return reject('Лицо не найдено');

                    const entry = {
                        id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                        name: name || file.name.replace(/\.[^.]+$/, '') || 'Без имени',
                        descriptor: Array.from(desc),
                        imageUrl: e.target.result
                    };
                    etalons.push(entry);
                    renderEtalons();
                    resolve(entry);
                } catch (err) {
                    reject(err);
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// ============================================================
//  4. ОТРИСОВАТЬ ЭТАЛОНЫ
// ============================================================
function renderEtalons() {
    etalonList.innerHTML = '';
    etalonCount.textContent = `Эталонов: ${etalons.length}`;

    if (!etalons.length) {
        etalonList.innerHTML = '<div class="empty-message">Нет эталонов. Добавьте фото!</div>';
        return;
    }

    etalons.forEach(e => {
        const div = document.createElement('div');
        div.className = 'photo-item';
        div.innerHTML = `
            <img src="${e.imageUrl}" alt="${e.name}">
            <span class="name-tag">${e.name}</span>
            <button class="remove-btn" data-id="${e.id}">✕</button>
        `;
        div.querySelector('.remove-btn').onclick = () => {
            etalons = etalons.filter(x => x.id !== e.id);
            renderEtalons();
        };
        etalonList.appendChild(div);
    });
}

// ============================================================
//  5. РАСПОЗНАВАНИЕ
// ============================================================
async function recognize(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const img = new Image();
            img.onload = async () => {
                try {
                    const desc = await getDescriptor(img);
                    if (!desc) return reject('Лицо не найдено');
                    if (!etalons.length) return reject('Нет эталонов');

                    const results = etalons.map(et => {
                        const dist = faceapi.euclideanDistance(desc, new Float32Array(et.descriptor));
                        const sim = Math.max(0, (1 - dist / 0.6) * 100);
                        return { ...et, distance: dist, similarity: sim };
                    });
                    results.sort((a, b) => b.similarity - a.similarity);
                    resolve(results);
                } catch (err) {
                    reject(err);
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// ============================================================
//  6. ПОКАЗАТЬ РЕЗУЛЬТАТ
// ============================================================
function showResult(results) {
    if (!results?.length) {
        testResult.innerHTML = `<span class="placeholder">❌ Ничего не найдено</span>`;
        return;
    }

    const top = results[0];
    let html = `
        <div class="match">
            <div class="name">${top.similarity > 50 ? '✅' : '❌'} ${top.name}</div>
            <div class="score">${top.similarity.toFixed(1)}% совпадения</div>
            <div class="bar"><div class="fill" style="width:${Math.min(top.similarity, 100)}%"></div></div>
            <div class="distance">Расстояние: ${top.distance.toFixed(4)}</div>
        </div>
    `;

    if (results.length > 1) {
        html += `<div class="other-matches"><strong>📋 Другие совпадения:</strong>`;
        results.slice(1, 5).forEach(r => {
            html += `<div class="row-item"><span>${r.name}</span><span>${r.similarity.toFixed(1)}%</span></div>`;
        });
        html += `</div>`;
    }

    testResult.innerHTML = html;
}

// ============================================================
//  7. СОБЫТИЯ
// ============================================================

// --- ВЫБОР ФОТО ДЛЯ ЭТАЛОНА ---
etalonInput.addEventListener('change', () => {
    const file = etalonInput.files[0];
    if (!file) return;

    pendingFile = file;

    // Показываем превью
    const reader = new FileReader();
    reader.onload = (e) => {
        etalonPreviewImg.src = e.target.result;
        etalonPreviewArea.style.display = 'block';
        etalonNameInput.value = file.name.replace(/\.[^.]+$/, '');
        etalonNameInput.focus();
        addBtn.disabled = false;
    };
    reader.readAsDataURL(file);
});

// --- КНОПКА "ДОБАВИТЬ ЭТАЛОН" ---
addBtn.addEventListener('click', async () => {
    if (!pendingFile) return;

    const name = etalonNameInput.value.trim() || 'Без имени';

    addBtn.disabled = true;
    addBtn.textContent = '⏳ Добавление...';

    try {
        await addEtalon(pendingFile, name);
        statusEl.textContent = `✅ Добавлен эталон: ${name}`;
        statusEl.style.borderColor = '#3fb950';

        // Очищаем форму
        pendingFile = null;
        etalonPreviewArea.style.display = 'none';
        etalonPreviewImg.src = '';
        etalonNameInput.value = '';
        etalonInput.value = '';
        addBtn.textContent = '➕ Добавить';
        addBtn.disabled = false;
    } catch (e) {
        statusEl.textContent = `⚠️ ${e}`;
        statusEl.style.borderColor = '#da3633';
        addBtn.textContent = '➕ Добавить';
        addBtn.disabled = false;
    }
});

// --- ВЫБОР ФОТО ДЛЯ РАСПОЗНАВАНИЯ ---
testInput.addEventListener('change', () => {
    const file = testInput.files[0];
    if (!file) return;

    // Превью
    const reader = new FileReader();
    reader.onload = (e) => {
        testPreview.innerHTML = `<img src="${e.target.result}" alt="тест">`;
        recognizeBtn.disabled = false;
    };
    reader.readAsDataURL(file);
});

// --- КНОПКА "РАСПОЗНАТЬ" ---
recognizeBtn.addEventListener('click', async () => {
    const file = testInput.files[0];
    if (!file) return;

    if (!etalons.length) {
        statusEl.textContent = '⚠️ Сначала добавь эталоны!';
        statusEl.style.borderColor = '#da3633';
        return;
    }

    recognizeBtn.disabled = true;
    recognizeBtn.textContent = '⏳ Распознавание...';
    testResult.innerHTML = '<span class="placeholder">⏳ Распознавание...</span>';

    try {
        const results = await recognize(file);
        showResult(results);
        statusEl.textContent = '✅ Распознано';
        statusEl.style.borderColor = '#3fb950';
    } catch (e) {
        testResult.innerHTML = `<span class="placeholder">❌ ${e}</span>`;
        statusEl.textContent = '❌ Ошибка';
        statusEl.style.borderColor = '#da3633';
    }

    recognizeBtn.disabled = false;
    recognizeBtn.textContent = '🔍 Распознать';
});

// --- ОЧИСТКА ВСЕХ ЭТАЛОНОВ ---
clearBtn.onclick = () => {
    if (confirm('Удалить все эталоны?')) {
        etalons = [];
        renderEtalons();
        testResult.innerHTML = `<span class="placeholder">⬅️ Загрузите фото для распознавания</span>`;
        testPreview.innerHTML = `<span class="placeholder">🖼 Фото появится здесь</span>`;
        statusEl.textContent = '🗑 Все эталоны удалены';
        statusEl.style.borderColor = '#da3633';
        recognizeBtn.disabled = true;
    }
};

// Отключаем кнопки изначально
addBtn.disabled = true;
recognizeBtn.disabled = true;

// ============================================================
//  8. СТАРТ
// ============================================================
loadModels();
