import { CategoryService } from "./category.service"
import { CategoryCreate } from "./category.types"


export class CategoryController {

    
    async createCategory(
        data: CategoryCreate,
        imageUrl: string | null
    ) {
        const service = new CategoryService()
        return service.createCategory(data, imageUrl)
    }
}
