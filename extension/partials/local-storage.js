
console.warn(`--- local-storage.js ---`);
;
import { callGetItem, callSetItem } from "../frames.js";

const excludeList = [
    'annotationHistory',
    'savedNotes',
    'voiceSavedNotes',
    'videoSavedNotes'
];

const customKey = "customLabelsAndCodes";
const customValue = [
    { "kyrie-code": {keyType: "code", options: ["dribble", "11"]} },
    { "lebron-label": {keyType: "label", options: ["dunk", "23"]} }
];
const newCustomValueItem = { "kobe-label": {keyType: "label", options: ["dunk", "23"]} };
/**
 * POST
 * @param key
 * @param value
 * @return void
 */
export function createObject(key, value){
    console.log(`-- createObject(key = ${key}, value = ${value}) --`);

    // localStorage.setItem(key, value);
    callSetItem(key, value);
}
// createObject(customKey, customValue);


/**
 * PUT
 * item is not a string it's an oject
 */
export async function updateObjectByKey(key, item) {
    console.log(`-- updateObjectByKey(key = ${key}, item = ${item}) --`);

    // Retrieve and parse the existing value
    let value = Object.values(await getObjectByKey(key) || {})[0] || [];

    // Push the new item to the array
    value.push(item);

    // Store the updated value back in localStorage
    createObject(key, value);
}
// addItemByKey(customKey, newCustomValueItem);

/**
 * GET
 * @param key
 * @returns {string}
 */
async function getObjectByKey(key){
    console.log(`-- getObjectByKey(key = ${key}) --`);
    // returns string type

    // return localStorage.getItem(key);
    return await callGetItem(key);
}
// console.log(JSON.parse(getObjectByKey(customKey)));

function getAllObjectKeys(){
    console.log(`-- getAllObjectKeys() --`);

    let objectKeyList = [];

    for (let i = 0; i < localStorage.length; i++) {
        objectKeyList[i] = localStorage.key(i);
    }

    return objectKeyList;
}
// console.log(getAllObjectKeys());

/**
 * DELETE
 */
export function deleteItemByKey(key){
    localStorage.delete(key);
}