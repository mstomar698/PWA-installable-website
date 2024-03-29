

let deferredPrompt;


// Storing the installation prompt
window.addEventListener("beforeinstallprompt", (event) => {
    deferredPrompt = event;
});

// Displaying the prompt on button click
const btn = document.getElementById('btn');
btn.addEventListener("click", () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt();
});

const DB_NAME = 'background-sync-db';
const DB_VERSION = 1;
const STORE_NAME = 'unsent-requests-store';

const IDB = {
    initialize() {
        return new Promise((resolve, reject) => {
            // Create a new DB
            const request = indexedDB.open(DB_NAME, DB_VERSION)
            request.onupgradeneeded = function () {
                request.result.createObjectStore(STORE_NAME)
                resolve()
            }
            request.onerror = function () {
                reject(request.error)
            }
        })
    },

    getByKey(key) {
        return new Promise((resolve, reject) => {
            const oRequest = indexedDB.open(DB_NAME, DB_VERSION)
            oRequest.onsuccess = function () {
                const db = oRequest.result
                const tx = db.transaction(STORE_NAME, 'readonly')
                const st = tx.objectStore(STORE_NAME)
                const gRequest = st.get(key)
                gRequest.onsuccess = function () {
                    resolve(gRequest.result)
                }
                gRequest.onerror = function () {
                    reject(gRequest.error)
                }
            }
            oRequest.onerror = function () {
                reject(oRequest.error)
            }
        })
    },

    setByKey(value, key) {
        return new Promise((resolve, reject) => {
            const oRequest = indexedDB.open(DB_NAME, DB_VERSION)
            oRequest.onsuccess = function () {
                const db = oRequest.result
                const tx = db.transaction(STORE_NAME, 'readwrite')
                const st = tx.objectStore(STORE_NAME)
                const sRequest = st.put(value, key)
                sRequest.onsuccess = function () {
                    resolve()
                }
                sRequest.onerror = function () {
                    reject(sRequest.error)
                }
            }
            oRequest.onerror = function () {
                reject(oRequest.error)
            }
        })
    },

    deletebyKey(key) {
        return new Promise((resolve, reject) => {
            const oRequest = indexedDB.open(DB_NAME, DB_VERSION)
            oRequest.onsuccess = function () {
                const db = oRequest.result
                const tx = db.transaction(STORE_NAME, 'readwrite')
                const st = tx.objectStore(STORE_NAME)
                const rRequest = st.delete(key)
                rRequest.onsuccess = function () {
                    resolve()
                }
                rRequest.onerror = function () {
                    reject(rRequest.error)
                }
            }
            oRequest.onerror = function () {
                reject(oRequest.error)
            }
        })
    },

    getAllKeys() {
        return new Promise((resolve, reject) => {
            const oRequest = indexedDB.open(DB_NAME, DB_VERSION)
            oRequest.onsuccess = function () {
                const db = oRequest.result
                const tx = db.transaction(STORE_NAME, 'readonly')
                const st = tx.objectStore(STORE_NAME)
                const kRequest = st.getAllKeys()
                kRequest.onsuccess = function () {
                    resolve(kRequest.result)
                }
                kRequest.onerror = function () {
                    reject(kRequest.error)
                }
            }
            oRequest.onerror = function () {
                reject(oRequest.error)
            }
        })
    }
}



const emailForm = document.querySelector('#email-form');
const emailInput = document.querySelector('#email-input');

IDB.initialize()

emailForm.addEventListener("submit", async (e) => {
    e.preventDefault()
    const data = {
        email: emailInput.value
    }
    emailInput.value = ""

    if ('serviceWorker' in navigator && 'SyncManager' in window && 'indexedDB' in window) {
        // storing the data in indexedDB
        await IDB.setByKey(Date.now(), data) // using current timestamp as key (not a recommended practice)

        // registering `background sync` task
        const registration = await navigator.serviceWorker.ready
        await registration.sync.register('sync-emails')

        console.log("[DB] data stored");
        console.log("[FORM] sync registered");
    } else {
        // sending the request directly in case `background sync` is not supported
        const response = await fetch('https://jsonplaceholder.typicode.com/posts', {
            method: 'POST',
            body: JSON.stringify(data),
            headers: {
                'Content-type': 'application/json; charset=UTF-8',
            },
        })
        const jsonData = await response.json()

        console.log("[FORM] submitted (sync not supported)");
        console.log("[RESPONSE]", jsonData);
    }
});

// sync handler
const syncEmails = async () => {
    const keys = await IDB.getAllKeys()

    for (const key of keys) {
        // sending data to the server
        const data = await IDB.getByKey(key)
        const response = await fetch('https://jsonplaceholder.typicode.com/posts', {
            method: 'POST',
            body: JSON.stringify(data),
            headers: {
                'Content-type': 'application/json; charset=UTF-8',
            },
        })

        const jsonData = await response.json()
        console.log("[RESPONSE]", jsonData)

        // removing the data from the `indexedDB` if data was sent successfully
        await IDB.deletebyKey(key)
        console.log("[DB] removed", key)
    }
};

// adding sync listener
self.addEventListener('sync', function (event) {
    console.log("[SYNC] sync event triggered");
    event.waitUntil(
        syncEmails()
            .then(() => console.log("[SYNC] Success"))
            .catch((err) => {
                console.log("[SYNC] Error")
                throw err
            })
    );
});
