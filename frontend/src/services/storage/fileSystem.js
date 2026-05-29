import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

const dirs = ['tmp', 'json_data', 'translations']


export async function initializeStorage() {
    for (const path of dirs) {
        try {
            await Filesystem.mkdir({
                path,
                directory: Directory.Data,
                recursive: true
            })
            console.warn("Making directory", path)
        } catch (e) {
            console.error("Error couldnt initialize directory: ", e)
        }
    }
}

export async function emptyStorage() {
    console.warn("Deleting Evelope")
    await deleteFile("envelope.json")
    for (const path of dirs) {
        try {
            await Filesystem.rmdir({
                path,
                directory: Directory.Data,
                recursive: true
            })
            console.warn("Deleting", path)
    
        } catch (e) {
            console.error("Failed to delete directory", e)
        }
    }
    console.warn("Initalising Directories")
    await initializeStorage()
}

export async function writeJsonFile(path, jsonData) {
    const data = await JSON.stringify(jsonData)
    try {
        await Filesystem.writeFile({
            path,
            data,
            directory: Directory.Data,
            encoding: Encoding.UTF8,
            recursive: true
        })
        return true
    }
    catch (e) {
        console.error("Unable to write file: ", e)
        return false
    }
}

export async function deleteFile(path) {
    try {
        await Filesystem.deleteFile({
            path,
            directory: Directory.Data,
        })
        return true
    } catch (e) {
        console.log("Unable to delete file", e)
        return false
    }
}

export async function readJsonFile(path) {
    try {
        const contents = await Filesystem.readFile({
            path,
            directory: Directory.Data,
            encoding: Encoding.UTF8
        })
        return await JSON.parse(contents.data)
    } catch (e) {
        console.error("Unable to read file: ", e)
        return false
    }
}

export async function commitFile(tmpPath, finalPath) {
    try {
        await Filesystem.rename({
            from: tmpPath,
            to: finalPath,
            directory: Directory.Data,
            encoding: Encoding.UTF8,
            recursive: true
        });
        return true;
    } catch (error) {
        console.error(`Failed to commit file from ${tmpPath} to ${finalPath}:`, error);
        return false;
    }
}

export async function purgeOldHashes(oldHashes) {
    for (const hash in oldHashes) {
        await Filesystem.deleteFile({
            path: '/'
        })
    }
}