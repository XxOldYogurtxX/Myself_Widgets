WidgetMetadata = {
    id: "discover_hub_ultimate",
    title: "探索发现 | 惊喜推荐",
    author: "OldYogurt",
    description: "基于𝙈𝙖𝙠𝙠𝙖𝙋𝙖𝙠𝙠𝙖修改聚合【今天看什么】、【Trakt惊喜推荐】与【那年今日】、一站式发现好片。",
    version: "1.1.1",
    requiredVersion: "0.0.1",
    site: "https://www.themoviedb.org",

    // 全局参数
    globalParams: [
        {
            name: "traktUser",
            title: "Trakt 用户名",
            type: "input",
            description: "必填！请填入 Trakt 真实 ID（非 'me'），且确保 Profile 为 Public。",
            value: ""
        },
        {
            name: "traktClientId",
            title: "Trakt Client ID (选填)",
            type: "input",
            description: "建议填入私有 ID 以提升稳定性。",
            value: ""
        }
    ],

    modules: [
        {
            title: "今天看什么（随机推荐）",
            functionName: "loadRecommendations",
            type: "list",
            cacheDuration: 0, 
            params: [
                {
                    name: "mediaType",
                    title: "想看什么",
                    type: "enumeration",
                    value: "tv",
                    enumOptions: [
                        { title: "电视剧 (TV Shows)", value: "tv" },
                        { title: "电影 (Movies)", value: "movie" }
                    ]
                }
            ]
        },
        {
            title: "Trakt惊喜推荐（分类历史推荐）",
            functionName: "loadRandomMix",
            type: "list",
            cacheDuration: 21600, 
            params: [
                {
                    name: "historyType",
                    title: "基于哪种历史推荐",
                    type: "enumeration",
                    value: "tv",
                    enumOptions: [
                        { title: "基于看过的电视剧", value: "tv" },
                        { title: "基于看过的电影", value: "movie" }
                    ]
                }
            ]
        },
        {
            title: "那年今日（历史回顾）",
            functionName: "loadHistoryToday",
            type: "list",
            cacheDuration: 43200, 
            params: [
                {
                    name: "region",
                    title: "上映地区",
                    type: "enumeration",
                    value: "Global",
                    enumOptions: [
                        { title: "全球 (Global)", value: "Global" },
                        { title: "美国 (US)", value: "US" },
                        { title: "中国 (CN)", value: "CN" },
                        { title: "香港 (HK)", value: "HK" },
                        { title: "日本 (JP)", value: "JP" }
                    ]
                },
                {
                    name: "sortOrder",
                    title: "排序方式",
                    type: "enumeration",
                    value: "time_desc",
                    enumOptions: [
                        { title: "时间: 由近到远", value: "time_desc" },
                        { title: "评分: 由高到低", value: "vote_desc" },
                        { title: "热度: 由高到低", value: "pop_desc" }
                    ]
                }
            ]
        }
    ]
};

// =========================================================================
// 通用工具与配置
// =========================================================================

const DEFAULT_TRAKT_ID = "003666572e92c4331002a28114387693994e43f5454659f81640a232f08a5996";

const GENRE_MAP = {
    28: "动作", 12: "冒险", 16: "动画", 35: "喜剧", 80: "犯罪", 99: "纪录片",
    18: "剧情", 10751: "家庭", 14: "奇幻", 36: "历史", 27: "恐怖", 10402: "音乐",
    9648: "悬疑", 10749: "爱情", 878: "科幻", 10770: "电视电影", 53: "惊悚",
    10752: "战争", 37: "西部", 10759: "动作冒险", 10762: "儿童", 10763: "新闻",
    10764: "真人秀", 10765: "科幻奇幻", 10766: "肥皂剧", 10767: "脱口秀", 10768: "战争政治"
};

function getGenreText(ids) {
    if (!ids || !Array.isArray(ids)) return "";
    return ids.map(id => GENRE_MAP[id]).filter(Boolean).slice(0, 3).join(" / ");
}

function buildItem({ id, tmdbId, type, title, year, poster, backdrop, rating, genreText, subTitle, desc }) {
    return {
        id: String(id),
        tmdbId: parseInt(tmdbId),
        type: "tmdb",
        mediaType: type,
        title: title,
        genreTitle: [year, genreText].filter(Boolean).join(" • "), 
        subTitle: subTitle,
        posterPath: poster ? `https://image.tmdb.org/t/p/w500${poster}` : "",
        backdropPath: backdrop ? `https://image.tmdb.org/t/p/w780${backdrop}` : "",
        description: desc || "暂无简介",
        rating: rating,
        year: year
    };
}

// =========================================================================
// 1. 业务逻辑：今天看什么
// =========================================================================

async function loadRecommendations(params = {}) {
    const { traktUser, mediaType = "tv" } = params;
    const traktClientId = params.traktClientId || DEFAULT_TRAKT_ID;
    let results = [], reason = "";

    if (traktUser && traktUser !== "me") {
        try {
            const historyItem = await fetchLastWatched(traktUser, mediaType, traktClientId);
            if (historyItem && historyItem.tmdbId) {
                reason = `✨ 因为你看过: ${historyItem.title}`;
                results = await fetchTmdbRecommendations(historyItem.tmdbId, mediaType);
            } else {
                reason = "🎲 随机发现";
                results = await fetchRandomTmdb(mediaType);
            }
        } catch (e) {
            reason = "连接延迟，随机推荐";
            results = await fetchRandomTmdb(mediaType);
        }
    } else {
        reason = "🎲 随机发现";
        results = await fetchRandomTmdb(mediaType);
    }

    return results.slice(0, 15).map(item => {
        const dateKey = mediaType === "tv" ? "first_air_date" : "release_date";
        const year = (item[dateKey] || "").substring(0, 4);
        return buildItem({
            id: item.id, tmdbId: item.id, type: mediaType,
            title: item.name || item.title,
            year: year, poster: item.poster_path, backdrop: item.backdrop_path,
            rating: item.vote_average?.toFixed(1),
            genreText: getGenreText(item.genre_ids),
            subTitle: reason, desc: item.overview
        });
    });
}

// =========================================================================
// 2. 业务逻辑：惊喜推荐 (增强版：支持分类)
// =========================================================================

async function loadRandomMix(params = {}) {
    const { traktUser, traktClientId, historyType = "tv" } = params;
    const clientId = traktClientId || DEFAULT_TRAKT_ID;
    const traktCategory = historyType === "tv" ? "shows" : "movies";

    if (!traktUser || traktUser === "me") {
        return [{ id: "err", type: "text", title: "需填写正确 Trakt 用户名", subTitle: "请在设置中修改 'me'" }];
    }

    const uniqueItems = await fetchUniqueHistory(traktUser, clientId, traktCategory);
    if (uniqueItems.length === 0) return [{ id: "empty", type: "text", title: `Trakt 无${historyType === "tv" ? "剧集" : "电影"}记录` }];

    const seeds = getRandomSeeds(uniqueItems.slice(0, 30), Math.min(uniqueItems.length, 5));
    const resultsArray = await Promise.all(seeds.map(seed => fetchTmdbRecsForSeed(seed, historyType)));

    const mixedList = [];
    let maxLen = Math.max(...resultsArray.map(l => l.length), 0);
    const seenIds = new Set();

    for (let i = 0; i < maxLen; i++) {
        for (const list of resultsArray) {
            if (i < list.length && !seenIds.has(list[i].tmdbId)) {
                seenIds.add(list[i].tmdbId);
                mixedList.push(list[i]);
            }
        }
    }

    return mixedList.slice(0, 20);
}

// =========================================================================
// 3. 业务逻辑：那年今日
// =========================================================================

async function loadHistoryToday(params = {}) {
    const { region = "Global", sortOrder = "time_desc" } = params;
    const today = new Date();
    const currentYear = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    const yearsAgo = [1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
    const targetYears = yearsAgo.map(diff => ({ year: currentYear - diff, diff: diff }));

    let allMovies = [];
    const batchRequest = async (years) => {
        const promises = years.map(yObj => fetchMovieForDate(yObj.year, month, day, region, yObj.diff));
        const results = await Promise.all(promises);
        results.forEach(list => { if (list) allMovies = allMovies.concat(list); });
    };

    await batchRequest(targetYears.slice(0, 5));
    await batchRequest(targetYears.slice(5, 10));
    await batchRequest(targetYears.slice(10));

    allMovies.sort((a, b) => {
        if (sortOrder === "time_desc") return parseInt(b.yearStr) - parseInt(a.yearStr);
        if (sortOrder === "vote_desc") return parseFloat(b.rating) - parseFloat(a.rating);
        return b.popularity - a.popularity;
    });

    return allMovies.slice(0, 20).map(item => buildItem({
        id: item.id, tmdbId: item.id, type: "movie",
        title: item.title, year: item.yearStr,
        poster: item.poster_path, backdrop: item.backdrop_path,
        rating: item.rating, genreText: getGenreText(item.genre_ids),
        subTitle: `TMDB ${item.rating}`, desc: `🏆 ${item.diff}周年纪念 | ${item.overview || "暂无简介"}`
    }));
}

// =========================================================================
// 4. API 辅助函数
// =========================================================================

async function fetchLastWatched(username, type, clientId) {
    const traktType = type === "tv" ? "shows" : "movies";
    const url = `https://api.trakt.tv/users/${username}/history/${traktType}?limit=1`;
    try {
        const res = await Widget.http.get(url, {
            headers: { "Content-Type": "application/json", "trakt-api-version": "2", "trakt-api-key": clientId },
            timeout: 8000
        });
        const data = res.data || [];
        if (data.length > 0) {
            const work = data[0].show || data[0].movie;
            if (work?.ids?.tmdb) return { tmdbId: work.ids.tmdb, title: work.title };
        }
    } catch (e) {}
    return null;
}

async function fetchUniqueHistory(username, clientId, category) {
    const url = `https://api.trakt.tv/users/${username}/history/${category}?limit=100`;
    try {
        const res = await Widget.http.get(url, {
            headers: { "Content-Type": "application/json", "trakt-api-version": "2", "trakt-api-key": clientId },
            timeout: 10000
        });
        const data = res.data || [];
        const uniqueMap = new Map();
        for (const item of data) {
            const work = category === "shows" ? item.show : item.movie;
            if (work?.ids?.tmdb && !uniqueMap.has(work.ids.tmdb)) {
                uniqueMap.set(work.ids.tmdb, { tmdbId: work.ids.tmdb, title: work.title });
            }
        }
        return Array.from(uniqueMap.values());
    } catch (e) { return []; }
}

async function fetchTmdbRecommendations(id, type) {
    try {
        const res = await Widget.tmdb.get(`/${type}/${id}/recommendations`, { params: { language: "zh-CN", page: 1 } });
        return (res.results || []);
    } catch (e) { return []; }
}

async function fetchTmdbRecsForSeed(seedItem, type) {
    try {
        const res = await Widget.tmdb.get(`/${type}/${seedItem.tmdbId}/recommendations`, { params: { language: "zh-CN", page: 1 } });
        if (!res?.results) return [];
        return res.results.slice(0, 5).map(item => {
            const dateKey = type === "tv" ? "first_air_date" : "release_date";
            const score = item.vote_average ? item.vote_average.toFixed(1) : "0.0";
            return buildItem({
                id: item.id, tmdbId: item.id, type: type,
                title: item.name || item.title,
                year: (item[dateKey] || "").substring(0, 4),
                poster: item.poster_path, backdrop: item.backdrop_path,
                rating: score, genreText: getGenreText(item.genre_ids),
                subTitle: `✨ 源于: ${seedItem.title}`,
                desc: `评分: ${score} | ${item.overview || "暂无简介"}`
            });
        });
    } catch (e) { return []; }
}

async function fetchRandomTmdb(type) {
    const page = Math.floor(Math.random() * 20) + 1;
    const year = Math.floor(Math.random() * (2024 - 2015 + 1)) + 2015;
    const queryParams = { language: "zh-CN", sort_by: "popularity.desc", "vote_count.gte": 100, page: page };
    if (type === "movie") queryParams["primary_release_year"] = year; else queryParams["first_air_date_year"] = year;

    try {
        const res = await Widget.tmdb.get(`/discover/${type}`, { params: queryParams });
        return (res.results || []).sort(() => 0.5 - Math.random());
    } catch (e) { return []; }
}

async function fetchMovieForDate(year, month, day, region, diff) {
    const dateStr = `${year}-${month}-${day}`;
    const queryParams = { language: "zh-CN", "primary_release_date.gte": dateStr, "primary_release_date.lte": dateStr };
    if (region === "Global") queryParams["vote_count.gte"] = 50; else { queryParams["region"] = region; queryParams["vote_count.gte"] = 10; }

    try {
        const res = await Widget.tmdb.get("/discover/movie", { params: queryParams });
        return (res.results || []).map(m => ({
            id: m.id, title: m.title, poster_path: m.poster_path, backdrop_path: m.backdrop_path,
            rating: m.vote_average ? m.vote_average.toFixed(1) : "0.0", overview: m.overview,
            yearStr: String(year), diff: diff, popularity: m.popularity, genre_ids: m.genre_ids || []
        }));
    } catch (e) { return []; }
}

function getRandomSeeds(array, count) {
    return array.sort(() => 0.5 - Math.random()).slice(0, count);
}