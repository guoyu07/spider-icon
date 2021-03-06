/**
 * html 页面数据抓取
 * cheerio 负责解析页面成特定数据格式
 * jQuery 方式处理dom节点，抓取数据
 * 可通过修改url参数page来实现分页数据抓取
 */
let fs = require("fs");
var superagent = require('superagent');
var charset = require('superagent-charset');
let asyncQuene = require("async").queue;
charset(superagent);
var express = require('express');
var baseUrl = 'http://app.hicloud.com/more/all/'; //华为应用市场，可换成其他任何网址
const cheerio = require('cheerio');
var app = express();

const Config = {
    page: 1,
    maxPageSize: 50, //最大页码，大于该页码结束爬取
    downloadImg: true, //是否下载图片到硬盘,否则只保存Json信息到文件
    downloadConcurrent: 10, //下载图片最大并发数
    folderName: "huawei" //当前程序要爬取得图片类型,取下面AllImgType的Key。
};

String.prototype.replaceAll = function(s1,s2){ 
    return this.replace(new RegExp(s1,"gm"),s2); 
}

app.get('/html', function(req, res) {

    run(res);

});

function run(res) {
    //网页页面信息是gb2312，所以chaeset应该为.charset('gb2312')，一般网页则为utf-8,可以直接使用.charset('utf-8')
    superagent.get(baseUrl + Config.page)
        // .charset('gb2312')
        .charset('utf-8')
        .end(function(err, sres) {
            var items = [];
            if (err) {
                console.log('ERR: ' + err);
                res.json({ code: 400, msg: err, sets: items });
                return;
            }
            var $ = cheerio.load(sres.text);
            //豌豆荚应用市场
            // $('#j-search-list li.search-item .icon-wrap a').each(function(idx, element) {
            //     var $element = $(element);
            //     var $subElement = $element.find('img');
            //     var thumbImgSrc = $subElement.attr('src');
            //     items.push({
            //         idx: idx,
            //         title: $(element).attr('title'),
            //         href: $element.attr('href'),
            //         thumbSrc: thumbImgSrc
            //     });
            // });

            //华为应用市场
            $('.lay-left .unit-main .list-game-app .game-info-ico a').each(function(idx, element) {
                var $element = $(element);
                var $subElement = $element.find('img');
                //华为应用市场首次加载dom时候src为默认值，所以获取lazyload的值
                var thumbImgSrc = $subElement.attr('lazyload').replaceAll('&#x2F;','/');
                items.push({
                    idx: idx,
                    title: $(element).attr('alt'),
                    href: $element.attr('href'),
                    thumbSrc: thumbImgSrc
                });
            });
            if(res) {
                res.json({ code: 200, msg: "", data: items });
            }
            
            downloadImg(items);
        });
};

function downloadImg(albumList) {
    console.log('Start download images ....');
    const folder = `img-${Config.folderName}`;
    if(!fs.existsSync(folder)) {
        fs.mkdirSync(folder);
    }
    let downloadCount = 0;
    let q = asyncQuene(async function ({ idx: idx, title: albumTile, url: imageUrl }, taskDone) {
        superagent.get(imageUrl).end(function (err, res) {
            if (err) {
                console.log(err);
            } else {
                if(idx < 10) {
                    idx = '0'+idx
                };
                fs.writeFile(`./${folder}/icon-${Config.page}${idx}.png`, res.body, function (err) {
                    err ? console.log(err) : console.log(`${imageUrl}保存一张`);
                });
                // taskDone()
            }
        });
    }, Config.downloadConcurrent);
    /**
     * 监听：当所有任务都执行完以后，将调用该函数
     */
    q.drain = function () {
        console.log('All img download');
        Config.page ++;
        if(Config.page <= Config.maxPageSize) {
            run();
        }
    }

    let imgListTemp = [];
    albumList.forEach(function ({ idx, title, thumbSrc }) {
        imgListTemp.push({ idx: idx, title: title, url: thumbSrc })
    });
    q.push(imgListTemp);//将所有任务加入队列
}

var server = app.listen(8081, function() {

    var host = server.address().address
    var port = server.address().port

    console.log("应用实例，访问地址为 http://%s:%s", host, port)

})
