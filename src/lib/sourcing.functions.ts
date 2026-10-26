import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
const input = z.object({notes:z.string().trim().min(1).max(12000),demand:z.array(z.object({product:z.string().max(80),demand:z.number().nonnegative(),sold:z.number().nonnegative(),saleable:z.number().nonnegative(),inPipeline:z.number().nonnegative(),outstanding:z.number().nonnegative(),buy:z.number().nonnegative()})).max(100)});
export const recommendSourcing = createServerFn({method:'POST'}).inputValidator(v=>input.parse(v)).handler(async({data})=>{
 const { compareOffers } = await import('./sourcing.server');
 return compareOffers(data);
});
