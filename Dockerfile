# Stage 1: build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy the csproj & restore dependencies (for caching)
COPY Innojam-SmartCity/Innojam-SmartCity.csproj ./Innojam-SmartCity/
RUN dotnet restore Innojam-SmartCity/Innojam-SmartCity.csproj

# Copy everything else
COPY . .

# Publish
RUN dotnet publish Innojam-SmartCity/Innojam-SmartCity.csproj -c Release -o /app/publish

# Stage 2: runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "Innojam-SmartCity.dll"]
