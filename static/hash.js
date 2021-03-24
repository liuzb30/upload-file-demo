self.importScripts("./spark-md5.min.js");

self.onmessage = e => {
    const { chunks } = e.data;
    const spark = new SparkMD5.ArrayBuffer();
    let len = chunks.length;

    const loadNext = cur => {
        const fileReader = new FileReader();
        fileReader.readAsArrayBuffer(chunks[cur].chunk);
        fileReader.onload = () => {
            spark.append(fileReader.result);
            cur++;
            if (cur < len) {
                const progress = Number(((cur * 100) / chunks.length).toFixed(2));
                self.postMessage({ progress });
                loadNext(cur);
            } else {
                self.postMessage({ progress: 100, hash: spark.end() });
            }
        };
    };

    loadNext(0);
};