// Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyC2D7HFSS_EoMn5_AB2uxERB6XH6028MGU",
    authDomain: "booking-bus-160993.firebaseapp.com",
    projectId: "booking-bus-160993",
    storageBucket: "booking-bus-160993.firebasestorage.app",
    messagingSenderId: "34576580396",
    appId: "1:34576580396:web:64bbd3005afb082ba13689",
    measurementId: "G-3KL6VKS818"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
  
  });
  
document.addEventListener('DOMContentLoaded', function() {
    initCityData();
    loadLayananData();
    setupDatePills();
    setInterval(() => { silentRefreshLayananData(); }, 60000);
    setInterval(() => {
        if(document.getElementById('tiketView').classList.contains('active')) { silentRefreshHistoryData(); }
    }, 10000);

    // Logika touchmove diperketat untuk menangkal pull-to-refresh
    let touchStartY = 0;
    document.addEventListener('touchstart', function(e) { touchStartY = e.touches[0].clientY; }, { passive: true });
    document.addEventListener('touchmove', function(e) {
        let scrollableEl = e.target.closest('.sheet-list, .bus-detail-panel, .app-container, .ticket-modal-white, .search-results-content');
        if (!scrollableEl) { if (e.cancelable) e.preventDefault(); return; }
        let isPullingDown = e.touches[0].clientY > touchStartY;
        // Hanya prevent default jika mencoba pull down saat berada di puncak scroll
        if (isPullingDown && scrollableEl.scrollTop <= 0) { 
            if (e.cancelable) e.preventDefault(); 
        }
    }, { passive: false });
});

flatpickr("#inputDepart", { locale: "id", dateFormat: "Y-m-d", altInput: true, altFormat: "l, j F Y", minDate: "today", disableMobile: "true" });

flatpickr("#bookingDateInput", {
    locale: "id", dateFormat: "Y-m-d", minDate: "today", disableMobile: "true",
    onChange: function(selectedDates, dateStr, instance) {
        selectedBookingDate = dateStr;
        const formatted = selectedDates[0].toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year: 'numeric'});
        document.getElementById('bookingDateDisplay').innerText = formatted;

        // Reset kursi saat ganti tanggal
        selectedSeatIds = [];
        document.getElementById('displayPrice').innerText = "0";
        document.getElementById('displaySeat').innerText = "Belum pilih kursi";
        document.getElementById('btnConfirmSeat').disabled = true;

        let isOperating = true;
        if (activeLayananData) {
            let offDateVal = activeLayananData.tglPembuatan || activeLayananData.tanggalLibur;
            if (offDateVal && offDateVal.toString().trim() !== "") {
                let offDate = "";
                let dObj = new Date(offDateVal);
                if (!isNaN(dObj)) { offDate = dObj.getFullYear() + "-" + String(dObj.getMonth() + 1).padStart(2, '0') + "-" + String(dObj.getDate()).padStart(2, '0');
                }
                else { offDate = offDateVal.toString().split('T')[0]; }
                if (offDate === dateStr || offDateVal.includes(dateStr)) { isOperating = false;
                }
            }
        }
        if (!isOperating) {
            document.getElementById('seatLayoutGrid').innerHTML = `
            <div style="grid-column: span 5; text-align: center; padding: 40px 20px; color: var(--booked-red);">
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 40px; margin-bottom: 12px; display: block; opacity: 0.8;"></i>
            <h4 style="margin: 0 0 8px 0; color: var(--text-dark);">Mitra Tidak Beroperasi</h4>
            <p style="margin: 0; font-size: 13px; color: var(--text-muted);">Mitra travel ini tidak beroperasi pada tanggal yang Anda pilih. Silakan pilih tanggal lain.</p>
            </div>`;
            document.getElementById("alertPopupMessage").innerText = "Mitra tidak beroperasi pada tanggal yang Anda pilih. Silakan pilih tanggal lain.";
            document.getElementById("alertPopup").classList.add("show");
        } else { refreshSeatLayout(); }
    }
});

async function initCityData() {
    try {
        const response = await fetch('https://raw.githubusercontent.com/yusufsyaifudin/wilayah-indonesia/master/data/list_of_area/regencies.json');
        if (response.ok) {
            const rawData = await response.json();
            databaseKota = rawData.map(item => {
                let name = item.name.toLowerCase();
                name = name.replace('kabupaten ', 'Kab. ').replace('kota ', '');
                return name.replace(/\b\w/g, c => c.toUpperCase());
            });
        }
    } catch (error) { console.warn("Gagal terhubung ke Github.", error); }
}

function toggleAdvancedSearch() {
    const container = document.getElementById('advancedSearchFields');
    const wrapper = document.getElementById('searchFormWrapper');
    const btn = document.getElementById('btnToggleExpand');
    if (container.classList.contains('expanded')) {
        container.classList.remove('expanded');
        btn.classList.remove('expanded');
        wrapper.classList.remove('active');
        btn.innerHTML = 'Pilihan Lainnya <i class="fa-solid fa-chevron-down"></i>';
    } else {
        container.classList.add('expanded');
        btn.classList.add('expanded');
        wrapper.classList.add('active');
        btn.innerHTML = 'Sembunyikan Pilihan <i class="fa-solid fa-chevron-down"></i>';
    }
}

function setupDatePills() {
    const today = new Date();
    const monthsIndo = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    document.getElementById('todayDateDisplay').innerText = `${today.getDate()} ${monthsIndo[today.getMonth()]} ${today.getFullYear()}`;
    const container = document.getElementById('dateFilterContainer');
    container.innerHTML = '';
    const daysIndo = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    for(let i = -2; i <= 7; i++) {
        let d = new Date(today);
        d.setDate(today.getDate() + i);
        let dayName = daysIndo[d.getDay()];
        let dateNum = d.getDate();
        let yy = d.getFullYear();
        let mm = String(d.getMonth() + 1).padStart(2, '0');
        let dd = String(d.getDate()).padStart(2, '0');
        let filterDateStr = `${yy}-${mm}-${dd}`;
        let isActive = i === 0 ? 'active' : '';
        let div = document.createElement('div');
        div.className = `date-card ${isActive}`;
        div.innerHTML = `<span class="day">${dayName}</span><span class="date">${dateNum}</span>`;
        div.onclick = () => {
            if(div.classList.contains('active')) {
                div.classList.remove('active');
                activeFilterDateStr = null;
            } else {
                document.querySelectorAll('.date-card').forEach(c => c.classList.remove('active'));
                div.classList.add('active');
                activeFilterDateStr = filterDateStr;
            }
            filterAndRenderTickets();
        };
        container.appendChild(div);
    }
}

function clearDateFilter() {
    document.querySelectorAll('.date-card').forEach(c => c.classList.remove('active'));
    activeFilterDateStr = null;
    filterAndRenderTickets();
}

async function loadLayananData() {
    try {
        let [resLayanan, resFasilitas] = await Promise.all([ fetch(GAS_URL + "?action=getAllLayanan"), fetch(GAS_URL + "?action=getFacilities") ]);
        allLayananData = await resLayanan.json();
        databaseFasilitas = await resFasilitas.json();
        let uniqueJenis = [...new Set(allLayananData.map(item => item.jenis).filter(Boolean))];
        databaseKendaraan = uniqueJenis.map(j => ({name: j, icon: "fa-bus"}));
        let uniqueCompany = [...new Set(allLayananData.map(item => item.namaPerusahaan).filter(Boolean))];
        databaseCompany = uniqueCompany;
        document.getElementById('loadingCards').style.display = 'none';
        renderServiceCards(allLayananData, 'ticketCardsContainer', false, null);
    } catch(e) { document.getElementById('loadingCards').innerHTML = "<p style='color:red;'>Gagal terhubung ke database.</p>"; }
}

async function silentRefreshLayananData() {
    try {
        let res = await fetch(GAS_URL + "?action=getAllLayanan");
        allLayananData = await res.json();
        let uniqueJenis = [...new Set(allLayananData.map(item => item.jenis).filter(Boolean))];
        databaseKendaraan = uniqueJenis.map(j => ({name: j, icon: "fa-bus"}));
        databaseCompany = [...new Set(allLayananData.map(item => item.namaPerusahaan).filter(Boolean))];
        if(!document.getElementById('searchResultsPanel').classList.contains('active')){
            renderServiceCards(allLayananData, 'ticketCardsContainer', false, null);
        }
    } catch(e) { console.error("Silent refresh gagal:", e); }
}

function calculateRealDuration(depart, arrive) {
    if(!depart || !arrive) return "-";
    try {
        let [depH, depM] = depart.split(':').map(Number);
        let [arrH, arrM] = arrive.split(':').map(Number);
        let diffMinutes = (arrH * 60 + arrM) - (depH * 60 + depM);
        if (diffMinutes < 0) diffMinutes += 24 * 60;
        let hours = Math.floor(diffMinutes / 60);
        let mins = diffMinutes % 60;
        return mins > 0 ? `${hours}j ${mins}m` : `${hours}j`;
    } catch (err) { return "-"; }
}

function formatRupiah(angka) { return Number(angka).toLocaleString('id-ID'); }

function renderServiceCards(data, targetContainerId, isSearchMode = false, searchDate = null) {
    const container = document.getElementById(targetContainerId);
    container.innerHTML = '';
    if(data.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#64748B; padding:20px;">Tidak ada jadwal operasional yang sesuai dengan pencarian Anda.</p>';
        return;
    }
    let today = new Date();
    let todayStr = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, '0') + "-" + String(today.getDate()).padStart(2, '0');
    let compareDate = searchDate ? searchDate : todayStr;
    
    data.forEach((item) => {
        let originalIndex = allLayananData.indexOf(item);
        let durationText = calculateRealDuration(item.jamBerangkat, item.jamSampai);
        let isOperating = true;
        let offDateVal = item.tglPembuatan || item.tanggalLibur;
        
        if (offDateVal && offDateVal.toString().trim() !== "") {
            let offDate = "";
            let dObj = new Date(offDateVal);
            if (!isNaN(dObj)) { offDate = dObj.getFullYear() + "-" + String(dObj.getMonth() + 1).padStart(2, '0') + "-" + String(dObj.getDate()).padStart(2, '0'); }
            else { offDate = offDateVal.toString().split('T')[0]; }
            if (offDate === compareDate || offDateVal.includes(compareDate)) { isOperating = false; }
        }
        
        if (isSearchMode && !isOperating) return;
        
        let cardClass = isOperating ? "ticket-card" : "ticket-card not-operating";
        let btnHtml = isOperating ?
        `<button class="booking-btn-card" onclick="openBusDetail(${originalIndex}, '${compareDate}')">Pilih Kursi</button>` :
        `<button class="booking-btn-card disabled" disabled>Tidak Beroperasi</button>`;
        
        let badgeHtml = isOperating ?
        `<span class="badge-cheapest">${item.namaPerusahaan}</span>` :
        `<span class="badge-cheapest">Tidak Beroperasi</span>`;
        
        let html = `
        <div class="${cardClass}">
        <div class="ticket-header">
        <div class="brand-info">${badgeHtml}<span class="brand-name">${item.merk}</span><span style="font-size: 12px; font-weight: 600; color: var(--text-muted); margin-top:2px;">${item.jenis}</span></div>
        <div class="price-container"><span class="price-label">Harga</span><div class="ticket-price">Rp ${formatRupiah(item.harga)}</div></div>
        </div>
        <div class="ticket-schedule">
        <div class="time-block"><h4>${item.jamBerangkat}</h4><p class="city">${item.asal}</p></div>
        <div class="duration-block"><div class="dur-line"></div><div class="dur-pill">${durationText}</div><div class="dur-line"></div></div>
        <div class="time-block right"><h4>${item.jamSampai}</h4><p class="city">${item.tujuan}</p></div>
        </div>
        ${btnHtml}
        </div>`;
        container.innerHTML += html;
    });
    
    if (container.innerHTML === '') {
        container.innerHTML = '<p style="text-align:center; color:#64748B; padding:20px;">Tidak ada jadwal operasional armada yang sesuai dengan pencarian Anda.</p>';
    }
}

function executeSearch() {
    let from = document.getElementById('valFrom').innerText;
    let to = document.getElementById('valTo').innerText;
    let date = document.getElementById('inputDepart').value;
    let vehicle = document.getElementById('displayVehicle').innerText;
    let company = document.getElementById('displayCompany').innerText;
    
    let isFromSet = !document.getElementById('valFrom').classList.contains('placeholder-active');
    let isToSet = !document.getElementById('valTo').classList.contains('placeholder-active');
    let isDateSet = date !== "";
    let isVehSet = !document.getElementById('displayVehicle').classList.contains('placeholder-active');
    let isCompanySet = !document.getElementById('displayCompany').classList.contains('placeholder-active');
    
    if (!isFromSet && !isToSet && !isDateSet && !isVehSet && !isCompanySet) {
        document.getElementById("alertPopupMessage").innerText = "Mohon isi minimal satu kriteria pencarian untuk melanjutkan!";
        document.getElementById("alertPopup").classList.add("show");
        return;
    }
    
    document.getElementById('busSearchLoader').classList.add('active');
    
    setTimeout(() => {
        document.getElementById('busSearchLoader').classList.remove('active');
        let filteredData = allLayananData.filter(item => {
            let match = true;
            if (isFromSet && item.asal !== from) match = false;
            if (isToSet && item.tujuan !== to) match = false;
            if (isVehSet && item.jenis !== vehicle) match = false;
            if (isCompanySet && item.namaPerusahaan !== company) match = false;
            if (isDateSet) {
                let offDateVal = item.tglPembuatan || item.tanggalLibur;
                if (offDateVal && offDateVal.toString().trim() !== "") {
                    let offDate = "";
                    let dObj = new Date(offDateVal);
                    if (!isNaN(dObj)) { offDate = dObj.getFullYear() + "-" + String(dObj.getMonth() + 1).padStart(2, '0') + "-" + String(dObj.getDate()).padStart(2, '0'); }
                    else { offDate = offDateVal.toString().split('T')[0]; }
                    if (offDate === date || offDateVal.includes(date)) { match = false; }
                }
            }
            return match;
        });
        document.getElementById('searchResultsPanel').classList.add('active');
        renderServiceCards(filteredData, 'searchResultsContainer', true, date !== "" ? date : null);
    }, 1800);
}

function closeSearchResults() {
    document.getElementById('searchResultsPanel').classList.remove('active');
    document.getElementById('valFrom').innerText = "Pilih Lokasi Asal";
    document.getElementById('valFrom').classList.add('placeholder-active');
    document.getElementById('valTo').innerText = "Pilih Lokasi Tujuan";
    document.getElementById('valTo').classList.add('placeholder-active');
    document.getElementById('inputDepart')._flatpickr.clear();
    document.getElementById('displayVehicle').innerText = "Pilih Bus";
    document.getElementById('displayVehicle').classList.add('placeholder-active');
    document.getElementById('displayCompany').innerText = "Pilih Perusahaan Travel";
    document.getElementById('displayCompany').classList.add('placeholder-active');
}

function switchTab(tabId, el) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('.nav-item-link').forEach(nav => nav.classList.remove('active'));
    if(el) el.classList.add('active');
    if(tabId === 'tiketView') fetchMyTicketsHistory();
}

async function silentRefreshHistoryData() {
    try {
        let res = await fetch(GAS_URL + "?action=getHistory&userid=" + encodeURIComponent(SESSION_USER_ID));
        let newData = await res.json();
        if (JSON.stringify(newData) !== JSON.stringify(myHistoryTickets)) {
            myHistoryTickets = newData;
            filterAndRenderTickets();
        }
    } catch(e) { console.warn("Silent refresh gagal: ", e); }
}

async function fetchMyTicketsHistory() {
    const container = document.getElementById('historyList');
    const loading = document.getElementById('loadingIndicator');
    Array.from(container.children).forEach(child => { if(child.id !== 'loadingIndicator') child.remove(); });
    loading.style.display = 'block';
    
    try {
        let res = await fetch(GAS_URL + "?action=getHistory&userid=" + encodeURIComponent(SESSION_USER_ID));
        myHistoryTickets = await res.json();
        loading.style.display = 'none';
        
        const today = new Date();
        let yy = today.getFullYear();
        let mm = String(today.getMonth() + 1).padStart(2, '0');
        let dd = String(today.getDate()).padStart(2, '0');
        activeFilterDateStr = `${yy}-${mm}-${dd}`;
        
        document.querySelectorAll('.date-card').forEach(c => {
            c.classList.remove('active');
            if (c.querySelector('.date').innerText == today.getDate()) { c.classList.add('active'); }
        });
        filterAndRenderTickets();
    } catch(e) {
        loading.style.display = 'none';
        container.insertAdjacentHTML('beforeend', '<p style="color:red; text-align:center;">Gagal memuat history pemesanan.</p>');
    }
}

function filterAndRenderTickets() {
    const query = document.getElementById('historySearchInput').value.toLowerCase();
    const filtered = myHistoryTickets.filter(tiket => {
        const textMatch = tiket.idBooking.toLowerCase().includes(query) ||
        (tiket.asal && tiket.asal.toLowerCase().includes(query)) ||
        (tiket.tujuan && tiket.tujuan.toLowerCase().includes(query)) ||
        (tiket.namaPenumpang || "").toLowerCase().includes(query);
        
        let dateMatch = true;
        if(activeFilterDateStr) {
            let tiketDateObj = new Date(tiket.waktuPemesanan);
            if(tiket.tanggalBooking && tiket.tanggalBooking !== "") { tiketDateObj = new Date(tiket.tanggalBooking); }
            if(!isNaN(tiketDateObj)) {
                let y = tiketDateObj.getFullYear();
                let m = String(tiketDateObj.getMonth() + 1).padStart(2, '0');
                let d = String(tiketDateObj.getDate()).padStart(2, '0');
                let tiketDateStr = `${y}-${m}-${d}`;
                dateMatch = (tiketDateStr === activeFilterDateStr);
            } else { dateMatch = false; }
        }
        return textMatch && dateMatch;
    });
    renderHistoryList(filtered);
}

function renderHistoryList(data) {
    const container = document.getElementById('historyList');
    Array.from(container.children).forEach(child => { if(child.id !== 'loadingIndicator') child.remove(); });
    
    if (data.length === 0) {
        container.insertAdjacentHTML('beforeend', '<p style="text-align:center; color:#94A3B8; margin-top:30px; font-weight:500;">Tidak ada pesanan ditemukan.</p>');
        return;
    }
    
    data.forEach((item, index) => {
        let statText = item.statusBooking || 'Belum Bayar';
        let statClass = "status-belum-bayar";
        let isLunas = false;
        
        if(statText.toLowerCase().includes('lunas') || statText.toLowerCase().includes('selesai')) { statClass = "status-lunas"; isLunas = true; }
        else if(statText.toLowerCase().includes('batal')) { statClass = "status-batal"; }
        
        let displayDate = item.tanggalBooking && item.tanggalBooking !== "" ? new Date(item.tanggalBooking) : new Date(item.waktuPemesanan);
        let dateStr = !isNaN(displayDate) ? displayDate.toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year: 'numeric'}) : "-";
        
        let bookingTimeObj = new Date(item.waktuPemesanan);
        let timeStr = !isNaN(bookingTimeObj) ? bookingTimeObj.toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) : "00:00";
        
        let delay = index * 0.05;
        let ruteText = (item.asal && item.tujuan) ? `${item.asal} - ${item.tujuan}` : "Rute Tidak Diketahui";
        
        let footerActionHtml = isLunas ?
        `<span class="company-name-stylized"><i class="fa-solid fa-bus-simple" style="font-size: 13px; margin-right: 4px;"></i> ${item.namaPerusahaan || 'Mitra Bus'}</span>` :
        `<button class="btn-cancel-order" onclick="event.stopPropagation(); confirmCancelTicket('${item.idBooking}')"><i class="fa-solid fa-trash-can" style="margin-right:4px;"></i> Batal</button>`;
        
        let html = `
        <div class="history-card" style="animation-delay: ${delay}s" onclick='openTicketModal(${JSON.stringify(item)})'>
        <div class="card-top">
        <span style="font-size: 12px; color: var(--text-muted); font-weight: 500;">
        <i class="far fa-calendar-alt" style="margin-right: 4px;"></i> ${dateStr}
        </span>
        <span class="status-badge ${statClass}">${statText}</span>
        </div>
        <div class="card-body">
        <div class="time-col">
        ${timeStr}<br>
        <span style="font-size:10px; font-weight:500; color:var(--text-muted);">WIB</span>
        </div>
        <div style="width: 2px; height: 35px; background: #E2E8F0; margin: 0 5px;"></div>
        <div class="route-col">
        <h3 style="font-size: 15px; font-weight: 700; margin: 0 0 4px 0; color: var(--text-dark);">${ruteText}</h3>
        <p style="font-size: 12px; color: var(--text-muted); margin: 0; font-weight: 500;">${item.merkKendaraan} • Kursi ${item.nomorKursi}</p>
        </div>
        </div>
        <div class="card-footer" style="display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px dashed #E2E8F0; margin-top: 10px;">
        ${footerActionHtml}
        <span class="booking-id-text">ID: ${item.idBooking}</span>
        </div>
        </div>`;
        container.insertAdjacentHTML('beforeend', html);
    });
}

function confirmCancelTicket(idBooking) {
    targetCancelId = idBooking;
    showPopup('modalCancelConfirm');
}

async function processCancelTicket() {
    if(!targetCancelId) return;
    const btn = document.getElementById('btnExecuteCancel');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Memproses...';
    btn.disabled = true;
    const payload = { action: "cancelTicket", userid: SESSION_USER_ID, idBooking: targetCancelId };
    try {
        let res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
        let result = await res.json();
        if (result.status === "success") {
            closeCustomPopups();
            myHistoryTickets = myHistoryTickets.filter(t => t.idBooking !== targetCancelId);
            filterAndRenderTickets();
        } else { alert("Gagal membatalkan: " + result.message); }
    } catch(e) { alert("Kesalahan jaringan saat mencoba membatalkan pesanan."); }
    finally { btn.innerHTML = originalText; btn.disabled = false; targetCancelId = null; }
}

function openTicketModal(item) {
    document.getElementById('modalCompanyNameTicket').innerText = (item.namaPerusahaan || "BOARDING PASS").toUpperCase();
    document.getElementById('modalIdBooking').innerText = "ID: " + item.idBooking;
    document.getElementById('modalNama').innerText = item.namaPenumpang || "Penumpang Umum";
    document.getElementById('modalKursi').innerText = item.nomorKursi;
    document.getElementById('modalRute').innerText = (item.asal && item.tujuan) ? `${item.asal} - ${item.tujuan}` : (item.rute || "-");
    document.getElementById('modalVehicleDetail').innerText = `${item.merkKendaraan} (${item.jenisKendaraan || '-'})`;
    
    let dateObj = item.tanggalBooking && item.tanggalBooking !== "" ? new Date(item.tanggalBooking) : new Date(item.waktuPemesanan);
    document.getElementById('modalTanggal').innerText = !isNaN(dateObj) ?
    dateObj.toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year: 'numeric'}) : item.waktuPemesanan;
    
    let bookingTimeObj = new Date(item.waktuPemesanan);
    document.getElementById('modalJam').innerText = !isNaN(bookingTimeObj) ?
    bookingTimeObj.toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) + " WIB" : "-";
    
    const badge = document.getElementById('modalStatusBadge');
    let statText = item.statusBooking || 'Belum Bayar';
    badge.innerText = statText;
    
    if(statText.toLowerCase().includes("belum") || statText.toLowerCase().includes("batal")) {
        badge.style.background = "rgba(239, 68, 68, 0.1)";
        badge.style.color = "#EF4444";
    } else {
        badge.style.background = "rgba(16, 185, 129, 0.1)"; badge.style.color = "#10B981";
    }
    
    const qrContainer = document.getElementById("qrcode");
    qrContainer.innerHTML = "";
    qrcodeObj = new QRCode(qrContainer, {
        text: item.idBooking, width: 120, height: 120,
        colorDark : "#1E293B", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.H
    });
    document.getElementById('ticketModal').classList.add('active');
}

function closeModal(e) {
    if (e.target.id === 'ticketModal') { document.getElementById('ticketModal').classList.remove('active'); }
}

async function openBusDetail(index, passedSearchDate = "") {
    activeLayananData = allLayananData[index];
    const item = activeLayananData;
    
    document.getElementById('detailCompanyName').innerText = item.namaPerusahaan;
    document.getElementById('detailClass').innerText = item.jenis;
    document.getElementById('detailMerk').innerText = item.merk;
    document.getElementById('detailRoute').innerHTML = `<i class="fa-solid fa-route" style="margin-right: 6px;"></i> ${item.asal} <i class="fa-solid fa-arrow-right" style="margin: 0 4px; font-size: 10px;"></i> ${item.tujuan}`;
    
    const heroBanner = document.getElementById('detailBannerHero');
    if(item.foto && item.foto.trim() !== "") { 
        heroBanner.style.backgroundImage = `linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(244, 247, 251, 0.2) 50%, var(--bg-light) 100%), url('${item.foto}')`;
    } else { 
        heroBanner.style.backgroundImage = `linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(244, 247, 251, 0.2) 50%, var(--bg-light) 100%), url('https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=800&auto=format&fit=crop')`; 
    }
    
    const facContainer = document.getElementById('amenitiesGrid');
    facContainer.innerHTML = '';
    if(item.fasilitas) {
        let facilities = item.fasilitas.split(',');
        facilities.forEach(fac => {
            let facName = fac.trim(); let match = databaseFasilitas.find(f => f.nama.toLowerCase() === facName.toLowerCase());
            let iconHtml = `<i class="fa-solid fa-circle-check"></i>`;
            if(match && match.icon) { iconHtml = match.icon.startsWith('http') ? `<img src="${match.icon}" alt="${facName}" style="width:18px;height:18px;margin-bottom:6px;">` : `<i class="${match.icon}"></i>`; }
            facContainer.innerHTML += `<div class="amenity-item">${iconHtml}<span>${facName}</span></div>`;
        });
    }
    
    const today = new Date();
    let yy = today.getFullYear(); let mm = String(today.getMonth() + 1).padStart(2, '0');
    let dd = String(today.getDate()).padStart(2, '0');
    let todayStr = `${yy}-${mm}-${dd}`;
    
    selectedBookingDate = passedSearchDate || todayStr;
    document.getElementById('bookingDateInput')._flatpickr.setDate(selectedBookingDate);
    let dObj = new Date(selectedBookingDate);
    document.getElementById('bookingDateDisplay').innerText = dObj.toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year: 'numeric'});
    document.getElementById('busDetailPanel').classList.add('active');

    refreshSeatLayout();
    
    if(seatPollingInterval) clearInterval(seatPollingInterval);
    seatPollingInterval = setInterval(() => {
        silentSeatRefresh();
    }, 5000);
}

async function refreshSeatLayout() {
    document.getElementById('seatLayoutGrid').innerHTML = '<div style="grid-column: span 5; text-align: center; padding: 20px; color: var(--text-muted);"><i class="fa-solid fa-circle-notch fa-spin"></i> Mengecek ketersediaan kursi...</div>';
    try {
        let dateOnly = selectedBookingDate.split('T')[0];
        let url = `${GAS_URL}?action=getBookedSeats&perusahaan=${encodeURIComponent(activeLayananData.namaPerusahaan)}&merk=${encodeURIComponent(activeLayananData.merk)}&tanggal=${encodeURIComponent(dateOnly)}`;
        let res = await fetch(url);
        let bookedSeats = await res.json();
        generateSeats(activeLayananData.kapasitas, bookedSeats);
    } catch(e) {
        console.error("Gagal mengecek kursi", e);
        generateSeats(activeLayananData.kapasitas, []);
    }
}

async function silentSeatRefresh() {
    if (!activeLayananData) return;
    try {
        let dateOnly = selectedBookingDate.split('T')[0];
        let url = `${GAS_URL}?action=getBookedSeats&perusahaan=${encodeURIComponent(activeLayananData.namaPerusahaan)}&merk=${encodeURIComponent(activeLayananData.merk)}&tanggal=${encodeURIComponent(dateOnly)}`;
        let res = await fetch(url);
        let bookedSeats = await res.json();

        const nodes = document.querySelectorAll('.seat-node:not(.empty):not(.aisle):not(.driver)');
        let selectionStolen = false;

        nodes.forEach(node => {
            let span = node.querySelector('span');
            if(!span) return;
            let label = span.innerText;
            let isNowBooked = bookedSeats.includes(label);

            if (isNowBooked) {
                if (selectedSeatIds.includes(label)) {
                    selectedSeatIds = selectedSeatIds.filter(id => id !== label);
                    selectionStolen = true;
                }
                node.className = 'seat-node booked';
                node.onclick = null;
            } else {
                if (!node.classList.contains('available') && !node.classList.contains('selected')) {
                    node.className = 'seat-node available';
                    node.onclick = function() { toggleSeatSelection(this, label); };
                }
            }
        });
        
        if (selectionStolen) {
            alert("Mohon maaf, salah satu kursi yang Anda pilih baru saja dipesan oleh pengguna lain (Real-time).");
            updateCheckoutPanel();
        }

        let actualBookedCount = bookedSeats.length;
        let cap = parseInt(activeLayananData.kapasitas) || 0;
        let availableCount = cap - actualBookedCount;
        let legendAvail = document.querySelector('.ml-dot.avail');
        let legendBooked = document.querySelector('.ml-dot.booked');
        
        if(legendAvail) legendAvail.parentNode.innerHTML = `<div class="ml-dot avail"></div>Bisa (${availableCount})`;
        if(legendBooked) legendBooked.parentNode.innerHTML = `<div class="ml-dot booked"></div>Full (${actualBookedCount})`;

    } catch(e) { console.error("Silent seat refresh failed", e); }
}

function closeBusDetail() {
    document.getElementById('busDetailPanel').classList.remove('active');
    selectedSeatIds = []; 
    updateCheckoutPanel();
    if(seatPollingInterval) { clearInterval(seatPollingInterval); seatPollingInterval = null; }
}

function generateSeats(kapasitas, bookedSeatsArray = []) {
    const grid = document.getElementById('seatLayoutGrid');
    grid.innerHTML = '';
    let cap = parseInt(kapasitas) || 0;
    let actualBookedCount = 0;
    let tempCol = 0;
    let tempRow = 1;
    const colsT = ['A', 'B', 'C', 'D'];
    
    for(let i = 1; i <= cap; i++) {
        let label = tempRow + colsT[tempCol];
        if(bookedSeatsArray.includes(label)) actualBookedCount++;
        tempCol++;
        if(tempCol === 4) { tempCol = 0; tempRow++; }
    }
    
    let availableCount = cap - actualBookedCount;
    grid.innerHTML += `<div class="modern-legend-panel"><div class="ml-item"><div class="ml-dot avail"></div>Bisa (${availableCount})</div><div class="ml-item"><div class="ml-dot booked"></div>Full (${actualBookedCount})</div><div class="ml-item"><div class="ml-dot sel"></div>Pilih</div></div>`;
    grid.innerHTML += `<div class="seat-node empty"></div><div class="seat-node empty"></div><div class="seat-node aisle"></div><div class="seat-node empty"></div><div class="seat-node driver"><i class="fa-solid fa-dharmachakra"></i></div>`;
    
    let colIndex = 0;
    let rowIndex = 1; const cols = ['A', 'B', 'C', 'D'];
    
    for(let i = 1; i <= cap; i++) {
        let label = rowIndex + cols[colIndex];
        let isBooked = bookedSeatsArray.includes(label);
        let isCurrentlySelected = selectedSeatIds.includes(label);

        let seat = document.createElement('div');
        seat.className = isBooked ? 'seat-node booked' : (isCurrentlySelected ? 'seat-node selected' : 'seat-node available');
        seat.innerHTML = `<span>${label}</span>`;
        if(!isBooked) { seat.onclick = function() { toggleSeatSelection(this, label); }; }
        grid.appendChild(seat);
        
        colIndex++;
        if (colIndex === 2) {
            let aisle = document.createElement('div');
            aisle.className = 'seat-node aisle'; grid.appendChild(aisle);
        } else if (colIndex === 4) { colIndex = 0; rowIndex++; }
    }
}

function toggleSeatSelection(node, label) {
    if (node.classList.contains('selected')) {
        node.classList.remove('selected');
        selectedSeatIds = selectedSeatIds.filter(id => id !== label);
    } else {
        node.classList.add('selected');
        selectedSeatIds.push(label);
    }
    updateCheckoutPanel();
}

function updateCheckoutPanel() {
    if (selectedSeatIds.length === 0) {
        document.getElementById('displayPrice').innerText = "0"; 
        document.getElementById('displaySeat').innerText = "Belum pilih kursi";
        document.getElementById('btnConfirmSeat').disabled = true;
    } else {
        let totalHarga = activeLayananData.harga * selectedSeatIds.length;
        document.getElementById('displayPrice').innerText = formatRupiah(totalHarga);
        document.getElementById('displaySeat').innerText = 'Kursi ' + selectedSeatIds.join(', '); 
        document.getElementById('btnConfirmSeat').disabled = false;
    }
}

function openCitySheet(target) {
    currentTarget = target;
    document.getElementById('sheetTitle').innerText = target === 'from' ? 'Pilih Kota Asal' : 'Pilih Kota Tujuan';
    document.getElementById('modalOverlay').classList.add('active'); document.getElementById('cityBottomSheet').classList.add('active');
    renderCityList(databaseKota);
}
function openVehicleSheet() {
    document.getElementById('modalOverlay').classList.add('active');
    document.getElementById('vehicleBottomSheet').classList.add('active');
    renderVehicleList(databaseKendaraan);
}
function openCompanySheet() {
    document.getElementById('modalOverlay').classList.add('active');
    document.getElementById('companyBottomSheet').classList.add('active');
    renderCompanyList(databaseCompany);
}
function closeAllSheets() {
    document.getElementById('modalOverlay').classList.remove('active');
    document.getElementById('cityBottomSheet').classList.remove('active');
    document.getElementById('vehicleBottomSheet').classList.remove('active');
    document.getElementById('companyBottomSheet').classList.remove('active');
}
function handleCitySearch(e) {
    const q = e.target.value.toLowerCase();
    const filtered = databaseKota.filter(c => c.toLowerCase().includes(q));
    renderCityList(filtered);
}
function handleVehicleSearch(e) {
    const q = e.target.value.toLowerCase();
    const filtered = databaseKendaraan.filter(c => c.name.toLowerCase().includes(q));
    renderVehicleList(filtered);
}
function handleCompanySearch(e) {
    const q = e.target.value.toLowerCase();
    const filtered = databaseCompany.filter(c => c.toLowerCase().includes(q));
    renderCompanyList(filtered);
}
function renderCityList(list) {
    const ul = document.getElementById('cityList');
    ul.innerHTML = '';
    list.forEach(city => {
        const li = document.createElement('li'); li.className = 'sheet-item'; li.innerHTML = `<i class="fa-solid fa-location-dot"></i> <span>${city}</span>`;
        li.onclick = () => { document.getElementById(currentTarget === 'from' ? 'valFrom' : 'valTo').innerText = city; document.getElementById(currentTarget === 'from' ? 'valFrom' : 'valTo').classList.remove('placeholder-active'); closeAllSheets(); };
        ul.appendChild(li);
    });
}
function renderVehicleList(list) {
    const ul = document.getElementById('vehicleList');
    ul.innerHTML = '';
    if(list.length === 0) { ul.innerHTML = '<li class="sheet-item" style="justify-content: center; color: gray;">Tidak ditemukan...</li>'; return; }
    list.forEach(veh => {
        const li = document.createElement('li'); li.className = 'sheet-item'; li.innerHTML = `<i class="fa-solid ${veh.icon}"></i> <span>${veh.name}</span>`;
        li.onclick = () => { document.getElementById('displayVehicle').innerText = veh.name; document.getElementById('displayVehicle').classList.remove('placeholder-active'); closeAllSheets(); };
        ul.appendChild(li);
    });
}
function renderCompanyList(list) {
    const ul = document.getElementById('companyList');
    ul.innerHTML = '';
    if(list.length === 0) { ul.innerHTML = '<li class="sheet-item" style="justify-content: center; color: gray;">Tidak ditemukan...</li>'; return; }
    list.forEach(comp => {
        const li = document.createElement('li'); li.className = 'sheet-item'; li.innerHTML = `<i class="fa-solid fa-building"></i> <span>${comp}</span>`;
        li.onclick = () => { document.getElementById('displayCompany').innerText = comp; document.getElementById('displayCompany').classList.remove('placeholder-active'); closeAllSheets(); };
        ul.appendChild(li);
    });
}
function swapRoutes() {
    const fromEl = document.getElementById('valFrom');
    const toEl = document.getElementById('valTo');
    const tempHTML = fromEl.innerHTML; const tempClass = fromEl.className;
    fromEl.innerHTML = toEl.innerHTML; fromEl.className = toEl.className;
    toEl.innerHTML = tempHTML; toEl.className = tempClass;
}
function showPopup(modalId) {
    document.querySelectorAll('.modern-popup').forEach(p => p.classList.remove('active'));
    document.getElementById('popupOverlay').classList.add('active');
    document.getElementById(modalId).classList.add('active');
}
function closeCustomPopups() {
    document.getElementById('popupOverlay').classList.remove('active');
    document.querySelectorAll('.modern-popup').forEach(p => p.classList.remove('active'));
}

function executeFinalBooking() {
    let total = formatRupiah(activeLayananData.harga * selectedSeatIds.length);
    let dObj = new Date(selectedBookingDate);
    let displayDate = dObj.toLocaleDateString('id-ID', {day: '2-digit', month: 'long', year: 'numeric'});
    document.getElementById('confirmModalText').innerHTML = `<b>Armada:</b> ${activeLayananData.merk} (${activeLayananData.namaPerusahaan})<br><b>Posisi Kursi:</b> Nomor ${selectedSeatIds.join(', ')}<br><b>Rute:</b> ${activeLayananData.asal} - ${activeLayananData.tujuan}<br><b>Tanggal Booking:</b> ${displayDate}<br><br><div style="font-size: 16px; color: var(--text-dark);">Total: <b>Rp ${total}</b></div>`;
    showPopup('modalConfirmation');
}

// PERUBAHAN PENTING: MENGGUNAKAN VARIABEL GLOBAL DARI JAGEL
async function processBookingData() {
    const btn = document.getElementById('btnProcessBooking');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...'; btn.disabled = true;
    let finalBookingDate = selectedBookingDate;
    if (selectedBookingDate && !selectedBookingDate.includes('T')) {
        let now = new Date();
        let hours = String(now.getHours()).padStart(2, '0');
        let mins = String(now.getMinutes()).padStart(2, '0');
        finalBookingDate = `${selectedBookingDate}T${hours}:${mins}:00`;
    }
    
    // Payload menarik data dari variabel lokal HTML Jagel
    const payload = {
        action: "bookTicket",
        userid: SESSION_USER_ID,
        nama: USER_NAMA,
        email: USER_EMAIL,
        hp: USER_HP,
        namaPerusahaan: activeLayananData.namaPerusahaan,
        merkKendaraan: activeLayananData.merk,
        idKursi: selectedSeatIds.join(', '),
        asal: activeLayananData.asal,
        tujuan: activeLayananData.tujuan,
        harga: activeLayananData.harga,
        jenisKendaraan: activeLayananData.jenis,
        tanggalBooking: finalBookingDate
    };
    
    try {
        let res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
        let result = await res.json();
        if (result.status === "success") {
            // MENGGUNAKAN VARIABEL USER_NAMA BUKAN SHORTCODE
            document.getElementById('successModalText').innerHTML = `Terima kasih <b>${USER_NAMA}</b>.<br>Kursi <b>${selectedSeatIds.join(', ')}</b> pada armada <b>${activeLayananData.merk}</b> telah dipesan.`;
            showPopup('modalSuccess');
        } else { alert("Terjadi kesalahan: " + result.message); }
    } catch(e) { alert("Kesalahan jaringan saat memproses pesanan."); }
    finally { btn.innerHTML = 'Proses'; btn.disabled = false; }
}

function finishAllProcess() {
    closeCustomPopups();
    closeBusDetail();
    if(document.getElementById('searchResultsPanel').classList.contains('active')){ executeSearch(); }
    fetchMyTicketsHistory();
}

// Tes tulis data ke Firestore
db.collection("Test").add({
  pesan: "Halo Firebase!",
  waktu: new Date()
})
.then(() => { console.log("Berhasil terhubung ke Firebase!"); })
.catch((error) => { console.error("Gagal terhubung: ", error); });
