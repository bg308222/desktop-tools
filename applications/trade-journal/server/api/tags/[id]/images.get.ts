export default defineEventHandler((event) => useRepos().tags.listImages(getRouterParam(event, 'id')!))
