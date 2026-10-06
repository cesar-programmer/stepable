# Guía de servicios HTTP del equipo Plataforma

Documento sintético de demostración de Stepable. La empresa, el equipo y los paquetes son ficticios.

## Cliente HTTP compartido

Toda llamada HTTP de un servicio usa el cliente compartido `httpClient`, que se importa del paquete interno `@demo/http`. Nunca se usa `fetch` directamente: el cliente compartido añade la autenticación, los tiempos de espera y el registro de errores que exige el equipo.

```ts
import { httpClient } from "@demo/http";

const response = await httpClient.get("/v2/users/42");
```

## Resultado de las funciones de servicio

Cada función de servicio devuelve un `Result<T>` y nunca lanza excepciones. Si la respuesta no es correcta, devuelve `{ ok: false, error: response.status }`. Si es correcta, devuelve `{ ok: true, value: response.body }`. Así, quien llama a la función siempre comprueba `ok` antes de usar el valor.

```ts
export async function getUser(id: string): Promise<Result<User>> {
  const response = await httpClient.get(`/v2/users/${id}`);
  if (!response.ok) return { ok: false, error: response.status };
  return { ok: true, value: response.body };
}
```

## Versión en la ruta

Las rutas de la API incluyen la versión mayor como primer segmento, por ejemplo `/v2/users`. Un cambio incompatible en un contrato publicado exige una nueva versión mayor (`/v3`); un cambio compatible mantiene la versión de la ruta.

## Pruebas de servicios

Las pruebas no llaman a la red. Sustituyen el cliente con `mockHttpClient` y comprueban el `Result` devuelto, tanto en el caso correcto como en el de error.

```ts
it("devuelve el error del servidor", async () => {
  mockHttpClient.get.mockResolvedValue({ ok: false, status: 404 });
  expect(await getUser("1")).toEqual({ ok: false, error: 404 });
});
```

## Revisión y despliegue

Toda solicitud de cambios necesita la aprobación de otra persona del equipo antes de fusionarse. Los despliegues a producción se hacen solo los martes y los jueves.
