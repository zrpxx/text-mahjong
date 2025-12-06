module.exports = {
    apps: [
        {
            name: 'TextMahjong',
            port: '4000',
            exec_mode: 'fork',
            instances: 1,
            script: './.output/server/index.mjs',
        },
    ],
}