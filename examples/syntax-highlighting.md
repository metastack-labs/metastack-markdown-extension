# Syntax Highlighting Demo

Test all 20 registered languages with realistic code snippets.

## JavaScript

```javascript
async function fetchUsers(limit = 10) {
  const response = await fetch(`/api/users?limit=${limit}`);
  const { data, total } = await response.json();
  return data.map(user => ({
    ...user,
    fullName: `${user.firstName} ${user.lastName}`,
    isActive: user.lastLogin > Date.now() - 86400000,
  }));
}
```

## TypeScript

```typescript
interface Config<T extends Record<string, unknown>> {
  readonly name: string;
  values: T;
  validate: (input: Partial<T>) => input is T;
}

class Registry<T extends Record<string, unknown>> {
  private configs = new Map<string, Config<T>>();

  register(config: Config<T>): void {
    if (this.configs.has(config.name)) {
      throw new Error(`Config "${config.name}" already registered`);
    }
    this.configs.set(config.name, Object.freeze(config));
  }
}
```

## Python

```python
from dataclasses import dataclass, field
from typing import Optional
import asyncio

@dataclass
class Pipeline:
    name: str
    stages: list[str] = field(default_factory=list)
    timeout: Optional[float] = None

    async def run(self) -> dict[str, bool]:
        results = {}
        for stage in self.stages:
            try:
                await asyncio.wait_for(self._execute(stage), self.timeout)
                results[stage] = True
            except asyncio.TimeoutError:
                results[stage] = False
        return results
```

## Rust

```rust
use std::collections::HashMap;
use tokio::sync::RwLock;

#[derive(Debug, Clone)]
pub struct Cache<V: Clone> {
    store: Arc<RwLock<HashMap<String, (V, Instant)>>>,
    ttl: Duration,
}

impl<V: Clone + Send + Sync + 'static> Cache<V> {
    pub async fn get_or_insert<F, Fut>(&self, key: &str, f: F) -> V
    where
        F: FnOnce() -> Fut,
        Fut: Future<Output = V>,
    {
        if let Some(value) = self.get(key).await {
            return value;
        }
        let value = f().await;
        self.insert(key.to_string(), value.clone()).await;
        value
    }
}
```

## Go

```go
func (s *Server) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("upgrade error: %v", err)
		return
	}
	defer conn.Close()

	client := &Client{
		conn: conn,
		send: make(chan []byte, 256),
	}
	s.hub.register <- client

	go client.writePump()
	client.readPump()
}
```

## SQL

```sql
WITH monthly_revenue AS (
    SELECT
        DATE_TRUNC('month', order_date) AS month,
        customer_id,
        SUM(amount) AS total_spent
    FROM orders
    WHERE status = 'completed'
    GROUP BY 1, 2
)
SELECT
    month,
    COUNT(DISTINCT customer_id) AS active_customers,
    AVG(total_spent) AS avg_revenue_per_customer,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_spent) AS median_spend
FROM monthly_revenue
GROUP BY month
ORDER BY month DESC;
```

## Bash

```bash
#!/bin/bash
set -euo pipefail

deploy() {
    local env="${1:?Usage: deploy <env>}"
    local tag=$(git describe --tags --always)

    echo "Deploying $tag to $env..."
    docker build -t "app:$tag" .
    docker push "registry.example.com/app:$tag"
    kubectl set image "deployment/app" "app=registry.example.com/app:$tag" \
        --namespace="$env"
    echo "Deployed successfully"
}

deploy "$@"
```

## Diff

```diff
- const API_URL = 'http://localhost:3000';
+ const API_URL = process.env.API_URL ?? 'https://api.example.com';

  async function connect() {
-   const response = await fetch(API_URL);
+   const response = await fetch(API_URL, {
+     headers: { 'Authorization': `Bearer ${token}` },
+   });
    return response.json();
  }
```

## JSON

```json
{
  "name": "metaexplore",
  "version": "0.1.0",
  "dependencies": {
    "highlight.js": "^11.11.1",
    "marked": "^15.0.12"
  },
  "scripts": {
    "build": "wxt zip",
    "dev": "wxt"
  }
}
```

## YAML

```yaml
services:
  api:
    build: ./api
    ports:
      - "8080:8080"
    environment:
      DATABASE_URL: postgres://db:5432/app
      REDIS_URL: redis://cache:6379
    depends_on:
      - db
      - cache
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      retries: 3
```

## CSS

```css
.container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: clamp(1rem, 3vw, 2rem);
  padding: var(--spacing-lg);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: hsl(220 13% 8%);
    --fg: hsl(210 20% 92%);
    --primary: hsl(217 91% 60%);
  }
}
```
