import BaseService from '../../../../services/BaseService';

Page({
    data: {
        bases: [],
        allBases: [],
        loading: false,
        searchKeyword: ''
    },

    onLoad() {
        this.loadBases();
    },

    onShow() {
        // Refresh list when returning from detail page
        this.loadBases();
    },

    async loadBases() {
        if (this.data.loading) return;
        this.setData({ loading: true });

        try {
            const bases = await BaseService.getBases();
            // Process bases for view (e.g. logo prefix)
            const processedBases = bases.map(b => ({
                ...b,
                code_prefix: b.code ? b.code.substring(0, 4).toUpperCase() : 'BASE'
            }));

            this.setData({
                allBases: processedBases,
                bases: this.filterBases(processedBases, this.data.searchKeyword)
            });
        } catch (err) {
            console.error('Failed to load bases', err);
        } finally {
            this.setData({ loading: false });
            wx.stopPullDownRefresh();
        }
    },

    onSearchInput(e) {
        const keyword = e.detail.value;
        this.setData({
            searchKeyword: keyword,
            bases: this.filterBases(this.data.allBases, keyword)
        });
    },

    filterBases(list, keyword) {
        if (!keyword) return list;
        const lowerKey = keyword.toLowerCase();
        return list.filter(b =>
            (b.name && b.name.toLowerCase().includes(lowerKey)) ||
            (b.code && b.code.toLowerCase().includes(lowerKey))
        );
    },

    onPullDownRefresh() {
        this.loadBases();
    },

    onAddBase() {
        wx.navigateTo({
            url: '/pkg_hq/pages/base/detail/index',
        });
    },

    // Edit logic (replaces generic tap)
    onEditBase(e) {
        const id = e.currentTarget.dataset.id;
        wx.navigateTo({
            url: `/pkg_hq/pages/base/detail/index?id=${id}`,
        });
    },

    // Appoint Principal logic
    onAssignPrincipal(e) {
        // e.currentTarget.dataset.item is needed? No, I only have id in dataset.
        // I need to find the item or add data-name to the button.
        // Let's modify wxml to pass data-name or just find from array. finding from array is safer if I don't want to bloat wxml.
        const id = e.currentTarget.dataset.id;
        const base = this.data.bases.find(b => b.id === id);
        const name = base ? base.name : '';

        wx.navigateTo({
            url: `/pkg_hq/pages/base/principal/index?id=${id}&name=${encodeURIComponent(name)}`,
        });
    }
});
